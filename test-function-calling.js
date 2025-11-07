// 测试模型的function calling能力
const testFunctionCalling = async () => {
  const response = await fetch('https://ai.wuhrai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${process.env.OPENAI_API_KEY || 'sk-your-key'}`
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'user', content: '检查磁盘空间' }
      ],
      tools: [
        {
          type: 'function',
          function: {
            name: 'execute_bash',
            description: '执行bash命令',
            parameters: {
              type: 'object',
              properties: {
                command: { type: 'string', description: '要执行的命令' }
              },
              required: ['command']
            }
          }
        }
      ],
      tool_choice: 'auto'
    })
  })
  
  const data = await response.json()
  console.log('Response:', JSON.stringify(data, null, 2))
  
  if (data.choices?.[0]?.message?.tool_calls) {
    console.log('✅ 模型支持function calling')
    console.log('Tool calls:', data.choices[0].message.tool_calls)
  } else {
    console.log('❌ 模型不支持function calling或API不支持')
  }
}

testFunctionCalling().catch(console.error)
