import ExpoModulesCore
import Foundation
import UIKit
import SpotifyiOS

private final class SpotifyRemoteDelegate: NSObject, SPTAppRemoteDelegate, SPTAppRemotePlayerStateDelegate {
  var onConnection: ((Bool) -> Void)?
  var onError: ((String) -> Void)?
  var onSubscribed: ((Bool, String?) -> Void)?
  var onTrack: (([String: Any]) -> Void)?

  func appRemoteDidEstablishConnection(_ appRemote: SPTAppRemote) {
    onConnection?(true)
    appRemote.playerAPI?.delegate = self
    appRemote.playerAPI?.subscribe(toPlayerState: { [weak self] _, error in
      if let error = error {
        self?.onSubscribed?(false, error.localizedDescription)
        self?.onError?(error.localizedDescription)
      } else {
        self?.onSubscribed?(true, nil)
      }
    })
    appRemote.playerAPI?.getPlayerState { [weak self] result, error in
      if let error = error {
        self?.onError?(error.localizedDescription)
      } else if let state = result as? SPTAppRemotePlayerState {
        self?.playerStateDidChange(state)
      }
    }
  }

  func appRemote(_ appRemote: SPTAppRemote, didFailConnectionAttemptWithError error: Error?) {
    onConnection?(false)
    onError?(error?.localizedDescription ?? "Spotify connection failed.")
  }

  func appRemote(_ appRemote: SPTAppRemote, didDisconnectWithError error: Error?) {
    onConnection?(false)
    if let error = error { onError?(error.localizedDescription) }
  }

  func playerStateDidChange(_ playerState: SPTAppRemotePlayerState) {
    let track = playerState.track
    onTrack?([
      "uri": track.uri,
      "title": track.name,
      "artist": track.artist.name,
      "album": track.album.name,
      "durationMs": track.duration,
      "isPaused": playerState.isPaused,
      "source": "spotify"
    ])
  }
}

private final class SpotifySessionDelegate: NSObject, SPTSessionManagerDelegate {
  var onSession: ((SPTSession) -> Void)?
  var onError: ((Error) -> Void)?

  func sessionManager(manager: SPTSessionManager, didInitiate session: SPTSession) {
    onSession?(session)
  }

  func sessionManager(manager: SPTSessionManager, didRenew session: SPTSession) {
    onSession?(session)
  }

  func sessionManager(manager: SPTSessionManager, didFailWith error: Error) {
    onError?(error)
  }
}

public class NowSpotifyModule: Module {
  private let clientID = "cace821f8d064214a7ad348e7a452386"
  private let redirectURL = URL(string: "ovrlee-spotify://callback")!
  private var appRemote: SPTAppRemote?
  private var remoteDelegate: SpotifyRemoteDelegate?
  private var sessionManager: SPTSessionManager?
  private var sessionDelegate: SpotifySessionDelegate?
  private var callbackObserver: NSObjectProtocol?
  private var originalCallback: URL?
  private var authorizationPending = false
  // Playlist authorization intentionally never starts App Remote playback.
  private var authorizationPurpose = "remote"
  private var playlistWebToken: String?
  private var playlistTokenExpiry: Date?
  private var callbackProcessed = false
  private var diagnosticEntries: [String] = []
  private var diagnosticStart = Date()
  private var diagnosticStage = "idle"
  private var connectAttemptID = 0
  private var connectionDeferredUntilActive = false
  private var appActiveObserver: NSObjectProtocol?
  private var awaitingRemoteConnection = false

  private func record(_ stage: String, _ detail: String) {
    diagnosticStage = stage
    let elapsed = Int(Date().timeIntervalSince(diagnosticStart) * 1000)
    let line = "[+\(elapsed)ms] \(stage): \(detail)"
    diagnosticEntries.append(line)
    if diagnosticEntries.count > 60 { diagnosticEntries.removeFirst() }
    NSLog("[OVRLEE Spotify] %@", line)
  }

  private func diagnosticReport() -> String {
    let header = "OVRLEE Spotify diagnostics v2 | stage=\(diagnosticStage) | token values excluded"
    return ([header] + diagnosticEntries).joined(separator: "\n")
  }

  private func reportError(_ code: String, _ detail: String) {
    record("FAIL/\(code)", detail)
    sendEvent("onError", ["message": "\(code): \(detail)"])
  }

  private func describeError(_ error: Error) -> String {
    let ns = error as NSError
    return "domain=\(ns.domain), code=\(ns.code), description=\(ns.localizedDescription)"
  }

  public func definition() -> ModuleDefinition {
    Name("NowSpotify")
    Events("onConnection", "onTrack", "onError", "onPlaylistAuthorized")

    OnCreate {
      self.appActiveObserver = NotificationCenter.default.addObserver(
        forName: UIApplication.didBecomeActiveNotification,
        object: nil,
        queue: .main
      ) { [weak self] _ in
        guard let self = self, self.awaitingRemoteConnection else { return }
        self.record("app_became_active", "pending App Remote connection; connected=\(self.appRemote?.isConnected ?? false)")
        if self.connectionDeferredUntilActive, let remote = self.appRemote {
          self.startRemoteConnection(remote, reason: "app returned active after authorization")
        }
      }
      self.callbackObserver = NotificationCenter.default.addObserver(
        forName: Notification.Name("OVRLEESpotifyOriginalCallback"),
        object: nil,
        queue: .main
      ) { [weak self] notification in
        guard let self = self, let url = notification.object as? URL else { return }
        guard url.scheme?.lowercased() == self.redirectURL.scheme?.lowercased() else { return }
        self.originalCallback = url
        let queryKeys = URLComponents(url: url, resolvingAgainstBaseURL: false)?.queryItems?.map { $0.name } ?? []
        // Report only whether a query/fragment exists and non-sensitive parameter names.
        let safeKeys = queryKeys.filter { !["code", "access_token", "refresh_token", "id_token", "state"].contains($0.lowercased()) }
        self.record("callback_received", "scheme=\(url.scheme ?? "none"), query=\(url.query == nil ? "no" : "yes"), fragment=\(url.fragment == nil ? "no" : "yes"), other_keys=\(safeKeys.joined(separator: ","))")
        self.processOriginalCallback(url)
      }
    }

    AsyncFunction("authorize") { () -> Bool in
      DispatchQueue.main.async {
        self.authorizationPurpose = "remote"
        self.authorizationPending = true
        self.callbackProcessed = false
        self.diagnosticEntries = []
        self.connectAttemptID += 1
        self.connectionDeferredUntilActive = false
        self.awaitingRemoteConnection = false
        self.diagnosticStart = Date()
        self.record("authorize_started", "SPTSessionManager clientOnly, appRemoteControl scope")
        self.originalCallback = nil
        let manager = self.ensureSessionManager()
        // Request the permission needed for Spotify App Remote playback state.
        // Spotify's session delegate provides the token; do not parse it from
        // App Remote's legacy authorizationParameters response.
        let scope: SPTScope = [.appRemoteControl]
        manager.initiateSession(with: scope, options: .clientOnly, campaign: nil)
        self.record("authorization_requested", "waiting for Spotify app and redirect")
      }
      return true
    }

    // Separate read-only playlist login. No App Remote and no playback required.
    AsyncFunction("authorizeForPlaylists") { () -> Bool in
      DispatchQueue.main.async {
        self.authorizationPurpose = "playlist"
        self.authorizationPending = true
        self.callbackProcessed = false
        self.originalCallback = nil
        self.playlistWebToken = nil
        self.playlistTokenExpiry = nil
        self.record("playlist_authorize", "requesting playlist and recent-listening read scopes")
        let scope: SPTScope = [.playlistReadPrivate, .playlistReadCollaborative, .userReadRecentlyPlayed]
        self.ensureSessionManager().initiateSession(with: scope, options: .default, campaign: nil)
      }
      return true
    }

    Function("getPlaylistAccessToken") { () -> String? in
      let read: () -> String? = {
        guard let token = self.playlistWebToken,
              let expiry = self.playlistTokenExpiry,
              expiry > Date().addingTimeInterval(30) else { return nil }
        return token
      }
      if Thread.isMainThread { return read() }
      return DispatchQueue.main.sync(execute: read)
    }

    Function("clearPlaylistAccessToken") {
      self.playlistWebToken = nil
      self.playlistTokenExpiry = nil
    }

    AsyncFunction("handleRedirect") { (urlString: String) -> Bool in
      // The AppDelegate may have already forwarded the unmodified callback.
      // Serialize callback state and SDK usage on the main queue.
      await MainActor.run {
        if self.callbackProcessed { return true }
        guard let url = self.originalCallback ?? URL(string: urlString),
              url.scheme?.lowercased() == self.redirectURL.scheme?.lowercased() else {
          return false
        }
        self.processOriginalCallback(url)
        return true
      }
    }

    Function("getDiagnostics") { () -> String in
      if Thread.isMainThread {
        return self.diagnosticReport()
      }
      return DispatchQueue.main.sync { self.diagnosticReport() }
    }

    AsyncFunction("connect") { () -> Bool in
      await MainActor.run {
        let remote = self.ensureRemote()
        guard let token = remote.connectionParameters.accessToken, !token.isEmpty else {
          self.reportError("NOT_AUTHORIZED", "Authorize Spotify before connecting")
          return false
        }
        self.startRemoteConnection(remote, reason: "manual connect")
        return true
      }
    }

    AsyncFunction("disconnect") { () -> Bool in
      DispatchQueue.main.async {
        self.appRemote?.playerAPI?.unsubscribe(toPlayerState: nil)
        self.appRemote?.disconnect()
      }
      return true
    }

    Function("isConnected") { () -> Bool in
      if Thread.isMainThread { return self.appRemote?.isConnected ?? false }
      return DispatchQueue.main.sync { self.appRemote?.isConnected ?? false }
    }

    OnDestroy {
      if let observer = self.appActiveObserver {
        NotificationCenter.default.removeObserver(observer)
        self.appActiveObserver = nil
      }
      self.connectAttemptID += 1
      self.awaitingRemoteConnection = false
      self.connectionDeferredUntilActive = false
      if let observer = self.callbackObserver {
        NotificationCenter.default.removeObserver(observer)
        self.callbackObserver = nil
      }
      self.originalCallback = nil
      self.playlistWebToken = nil
      self.playlistTokenExpiry = nil
      self.appRemote?.playerAPI?.unsubscribe(toPlayerState: nil)
      self.appRemote?.disconnect()
      self.appRemote = nil
      self.remoteDelegate = nil
      self.sessionManager = nil
      self.sessionDelegate = nil
    }
  }

  private func processOriginalCallback(_ url: URL) {
    guard !callbackProcessed else { return }
    callbackProcessed = true
    record("callback_processing", "passing original URL to SPTSessionManager")
    let accepted = ensureSessionManager().application(UIApplication.shared, open: url, options: [:])
    record("callback_parsed", "session manager accepted=\(accepted)")
    if !accepted {
      authorizationPending = false
      reportError("CALLBACK_REJECTED", "Session manager did not recognize the authorization callback")
    }
  }

  private func ensureSessionManager() -> SPTSessionManager {
    if let manager = sessionManager { return manager }
    let configuration = SPTConfiguration(clientID: clientID, redirectURL: redirectURL)
    configuration.playURI = ""
    let delegate = SpotifySessionDelegate()
    delegate.onSession = { [weak self] session in
      guard let self = self else { return }
      // Spotify calls delegates on the main thread; enforce it defensively.
      if !Thread.isMainThread {
        DispatchQueue.main.async { self.acceptSession(session) }
        return
      }
      self.acceptSession(session)
    }
    delegate.onError = { [weak self] error in
      DispatchQueue.main.async {
        guard let self = self else { return }
        self.authorizationPending = false
        self.reportError("SESSION_FAILED", self.describeError(error))
      }
    }
    let manager = SPTSessionManager(configuration: configuration, delegate: delegate)
    sessionDelegate = delegate
    sessionManager = manager
    return manager
  }

  private func acceptSession(_ session: SPTSession) {
      self.authorizationPending = false
      self.record("session_created", "session delegate succeeded; token_present=\(!session.accessToken.isEmpty)")
      guard !session.accessToken.isEmpty else {
        self.reportError("SESSION_TOKEN_MISSING", "Session manager returned an empty token")
        return
      }
      if self.authorizationPurpose == "playlist" {
        self.playlistWebToken = session.accessToken
        self.playlistTokenExpiry = session.expirationDate
        self.record("playlist_session_ready", "read-only token available, expires in seconds=\(Int(session.expirationDate.timeIntervalSinceNow))")
        self.sendEvent("onPlaylistAuthorized", ["authorized": true])
        return
      }
      let remote = self.ensureRemote()
      remote.connectionParameters.accessToken = session.accessToken
      self.startRemoteConnection(remote, reason: "session token assigned")
  }

  // Keep the public JS API unchanged. This watchdog makes an otherwise silent
  // App Remote connection attempt produce a useful native diagnostic and error.
  private func startRemoteConnection(_ remote: SPTAppRemote, reason: String) {
    if remote.isConnected {
      awaitingRemoteConnection = false
      record("remote_already_connected", reason)
      sendEvent("onConnection", ["connected": true])
      return
    }
    if awaitingRemoteConnection && !connectionDeferredUntilActive {
      record("remote_connect_skipped", "prior connection attempt still pending; reason=\(reason)")
      return
    }
    connectAttemptID += 1
    let attempt = connectAttemptID
    awaitingRemoteConnection = true
    let spotifyInstalled = UIApplication.shared.canOpenURL(URL(string: "spotify://")!)
    let state = UIApplication.shared.applicationState
    let appState = state == .active ? "active" : (state == .inactive ? "inactive" : "background")
    if state != .active {
      connectionDeferredUntilActive = true
      record("remote_waiting_for_foreground", "reason=\(reason); app_state=\(appState); spotify_installed=\(spotifyInstalled)")
      return
    }
    connectionDeferredUntilActive = false
    record("remote_connect_requested", "reason=\(reason); app_state=\(appState); spotify_installed=\(spotifyInstalled); connected_before=false")
    remote.connect()
    DispatchQueue.main.asyncAfter(deadline: .now() + 3.0) { [weak self] in
      guard let self = self, self.connectAttemptID == attempt, self.awaitingRemoteConnection else { return }
      self.record("remote_pending_3s", "connected=\(remote.isConnected); app_state=\(UIApplication.shared.applicationState.rawValue); delegate_callback_not_received=true")
    }
    DispatchQueue.main.asyncAfter(deadline: .now() + 15.0) { [weak self] in
      guard let self = self, self.connectAttemptID == attempt else { return }
      guard self.awaitingRemoteConnection, !remote.isConnected else { return }
      self.awaitingRemoteConnection = false
      self.connectAttemptID += 1
      self.reportError("REMOTE_CONNECT_TIMEOUT", "No App Remote success/failure delegate callback within 15 seconds; app_state=\(UIApplication.shared.applicationState.rawValue); spotify_installed=\(UIApplication.shared.canOpenURL(URL(string: "spotify://")!)); delegate_present=\(remote.delegate != nil)")
    }
  }

  private func ensureRemote() -> SPTAppRemote {
    if let remote = appRemote { return remote }
    let configuration = SPTConfiguration(clientID: clientID, redirectURL: redirectURL)
    let remote = SPTAppRemote(configuration: configuration, logLevel: .debug)
    let delegate = SpotifyRemoteDelegate()
    delegate.onConnection = { [weak self] connected in
      if connected {
        self?.awaitingRemoteConnection = false
        self?.connectAttemptID += 1
      }
      self?.record(connected ? "remote_connected" : "remote_disconnected", "connected=\(connected)")
      self?.sendEvent("onConnection", ["connected": connected])
    }
    delegate.onSubscribed = { [weak self] success, detail in
      self?.record(success ? "playback_subscribed" : "playback_subscription_failed", detail ?? "player-state subscription callback")
    }
    delegate.onError = { [weak self] message in
      self?.record("remote_error", message)
      self?.awaitingRemoteConnection = false
      self?.connectAttemptID += 1
      self?.sendEvent("onError", ["message": message])
    }
    delegate.onTrack = { [weak self] track in
      self?.sendEvent("onTrack", track)
    }
    remote.delegate = delegate
    remoteDelegate = delegate
    appRemote = remote
    return remote
  }
}
