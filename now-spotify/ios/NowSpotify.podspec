Pod::Spec.new do |s|
  s.name               = 'NowSpotify'
  s.version            = '1.0.0'
  s.summary            = 'OVRLEE Spotify App Remote integration'
  s.description        = 'Spotify authorization and live playback monitoring for OVRLEE.'
  s.license            = 'MIT'
  s.author             = 'OVRLEE'
  s.homepage           = 'https://ovrlee.com'
  s.platforms          = { :ios => '17.0' }
  s.source             = { :path => '.' }
  s.static_framework   = true
  s.dependency 'ExpoModulesCore'
  s.vendored_frameworks = 'SpotifyiOS.xcframework'
  s.source_files       = 'NowSpotifyModule.swift'
end
