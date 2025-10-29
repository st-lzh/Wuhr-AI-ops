import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { username, password } = body

    return NextResponse.json({
      success: true,
      message: 'Test endpoint working',
      data: { username }
    })

  } catch (error) {
    console.error('Test error:', error)
    
    return NextResponse.json({
      success: false,
      error: 'Test failed'
    }, { status: 500 })
  }
}
