import build from 'pino-abstract-transport'

export default function (opts: any) {
  return build((source) => {
    source.on('data', (obj) => {
      console.log(obj)
    })
  })
}
