import ExpoModulesCore
import ShazamKit
import AVFoundation

private final class NowShazamSessionDelegate: NSObject, SHSessionDelegate {
  var onMatch: ((SHMatch) -> Void)?
  var onError: ((Error) -> Void)?

  func session(_ session: SHSession, didFind match: SHMatch) {
    onMatch?(match)
  }

  func session(_ session: SHSession, didNotFindMatchFor signature: SHSignature, error: Error?) {
    if let error = error {
      onError?(error)
    }
  }
}

public class NowShazamModule: Module {
  private let session = SHSession()
  private let shazamDelegate = NowShazamSessionDelegate()
  private var engine: AVAudioEngine?
  private var listening = false

  public func definition() -> ModuleDefinition {
    Name("NowShazam")
    Events("onMatch", "onError")

    AsyncFunction("start") { (promise: Promise) in
      DispatchQueue.main.async {
        guard !self.listening else {
          promise.resolve(nil)
          return
        }

        AVAudioApplication.requestRecordPermission { granted in
          guard granted else {
            promise.reject("MIC_PERMISSION", "Microphone permission denied")
            return
          }

          DispatchQueue.main.async {
            do {
              let audioSession = AVAudioSession.sharedInstance()
              try audioSession.setCategory(
                .playAndRecord,
                mode: .measurement,
                options: [.mixWithOthers, .allowBluetoothA2DP]
              )
              try audioSession.setActive(true)

              self.shazamDelegate.onMatch = { [weak self] match in
                DispatchQueue.main.async {
                  guard let self = self, self.listening else { return }
                  guard let item = match.mediaItems.first else { return }

                  let result: [String: String] = [
                    "title": item.title ?? "Unknown song",
                    "artist": item.artist ?? "Unknown artist",
                    "appleMusicId": item.appleMusicID ?? "",
                    "isrc": item.isrc ?? ""
                  ]

                  // Release the microphone as soon as a song is recognized.
                  self.stopEngine()
                  self.sendEvent("onMatch", result)
                }
              }

              self.shazamDelegate.onError = { [weak self] error in
                DispatchQueue.main.async {
                  guard let self = self, self.listening else { return }
                  self.stopEngine()
                  self.sendEvent("onError", [
                    "message": error.localizedDescription
                  ])
                }
              }

              self.session.delegate = self.shazamDelegate

              let engine = AVAudioEngine()
              let input = engine.inputNode
              let format = input.outputFormat(forBus: 0)

              guard format.sampleRate > 0 else {
                self.stopEngine()
                promise.reject("NO_MIC", "Microphone input unavailable")
                return
              }

              input.installTap(onBus: 0, bufferSize: 4096, format: format) { [weak self] buffer, time in
                self?.session.matchStreamingBuffer(buffer, at: time)
              }

              self.engine = engine
              engine.prepare()
              try engine.start()
              self.listening = true
              promise.resolve(nil)
            } catch {
              self.stopEngine()
              promise.reject("SHAZAM_START", error.localizedDescription)
            }
          }
        }
      }
    }

    AsyncFunction("stop") { (promise: Promise) in
      DispatchQueue.main.async {
        self.stopEngine()
        promise.resolve(nil)
      }
    }

    OnDestroy {
      self.stopEngine()
    }
  }

  private func stopEngine() {
    listening = false
    if let engine = engine {
      engine.inputNode.removeTap(onBus: 0)
      engine.stop()
    }
    engine = nil
    try? AVAudioSession.sharedInstance().setActive(
      false,
      options: .notifyOthersOnDeactivation
    )
  }
}
