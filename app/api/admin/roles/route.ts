import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  return NextResponse.json({
    success: true,
    message: '角色管理API开发中',
    data: []
  })
}

export async function POST(request: NextRequest) {
  return NextResponse.json({
    success: false,
    message: '角色管理API开发中'
  })
}