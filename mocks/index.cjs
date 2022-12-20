// eslint-disable-next-line @typescript-eslint/no-var-requires
const { setupServer } = require('msw/node')

const server = setupServer()

server.listen({ onUnhandledRequest: 'bypass' })
console.info('🔶 Mock server running')

process.once('SIGINT', () => server.close())
process.once('SIGTERM', () => server.close())
