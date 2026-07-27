import http from 'node:http'

const port = Number(process.env.MOCK_JENKINS_PORT || 18080)
const publicBaseUrl = process.env.MOCK_JENKINS_PUBLIC_URL || `http://host.docker.internal:${port}`
const jobName = process.env.MOCK_JENKINS_JOB || 'wuhr-smoke'
const queueId = 1
const buildNumber = 41
const startedAt = Date.now() - 1_500

function sendJson(response, status, body, headers = {}) {
  response.writeHead(status, { 'Content-Type': 'application/json', ...headers })
  response.end(JSON.stringify(body))
}

const server = http.createServer((request, response) => {
  const url = new URL(request.url || '/', publicBaseUrl)
  const encodedJob = encodeURIComponent(jobName)

  if (request.method === 'GET' && url.pathname === '/api/json') {
    return sendJson(response, 200, {
      version: '2.452.3-smoke',
      mode: 'NORMAL',
      nodeDescription: 'Wuhr AI Ops CI/CD smoke test',
      jobs: [{ name: jobName, displayName: jobName, url: `${publicBaseUrl}/job/${encodedJob}/` }],
      primaryView: { name: 'smoke' },
      useCrumbs: false
    })
  }

  if (request.method === 'GET' && url.pathname === `/job/${encodedJob}/api/json`) {
    return sendJson(response, 200, {
      name: jobName,
      displayName: jobName,
      buildable: true,
      nextBuildNumber: buildNumber + 1,
      property: []
    })
  }

  if (request.method === 'POST' && [
    `/job/${encodedJob}/build`,
    `/job/${encodedJob}/buildWithParameters`
  ].includes(url.pathname)) {
    response.writeHead(201, { Location: `${publicBaseUrl}/queue/item/${queueId}/` })
    return response.end()
  }

  if (request.method === 'GET' && url.pathname === `/queue/item/${queueId}/api/json`) {
    return sendJson(response, 200, {
      id: queueId,
      cancelled: false,
      executable: {
        number: buildNumber,
        url: `${publicBaseUrl}/job/${encodedJob}/${buildNumber}/`
      }
    })
  }

  if (request.method === 'GET' && url.pathname === `/job/${encodedJob}/${buildNumber}/api/json`) {
    return sendJson(response, 200, {
      number: buildNumber,
      building: false,
      result: 'SUCCESS',
      duration: 1_200,
      estimatedDuration: 1_200,
      timestamp: startedAt,
      url: `${publicBaseUrl}/job/${encodedJob}/${buildNumber}/`
    })
  }

  if (request.method === 'GET' && url.pathname === `/job/${encodedJob}/${buildNumber}/consoleText`) {
    response.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' })
    return response.end('Checkout\nBuild\nTest\nFinished: SUCCESS\n')
  }

  return sendJson(response, 404, { message: `Unknown mock Jenkins endpoint: ${request.method} ${url.pathname}` })
})

server.listen(port, '0.0.0.0', () => {
  process.stdout.write(`Mock Jenkins listening on ${port} for job ${jobName}\n`)
})

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => server.close(() => process.exit(0)))
}
