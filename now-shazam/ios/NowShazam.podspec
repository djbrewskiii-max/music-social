Pod::Spec.new do |s|
  s.name           = 'NowShazam'
  s.version        = '1.0.0'
  s.summary        = 'Isolated NOW ShazamKit experiment'
  s.description    = 'Opt-in audio recognition via ShazamKit.'
  s.license        = 'MIT'
  s.author         = 'NOW'
  s.homepage       = 'https://example.com'
  s.platforms      = { :ios => '17.0' }
  s.source         = { :path => '.' }
  s.static_framework = true
  s.dependency 'ExpoModulesCore'
  s.frameworks     = 'ShazamKit', 'AVFoundation'
  s.source_files   = '**/*.{h,m,mm,swift}'
end
