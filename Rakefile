require 'rake/clean'

TARGETS = Dir['jquery/*{[!min]}.js'].map do |source|
  file source.pathmap('%X.min%x') => source do |t|
    sh "uglifyjs #{t.source} -o #{t.name} --mangle --compress"
  end.name
end

CLEAN.include TARGETS

task default: :minify

desc 'minify jquery plugins'
task minify: TARGETS
