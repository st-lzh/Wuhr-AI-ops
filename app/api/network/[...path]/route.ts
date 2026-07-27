import { NextRequest } from 'next/server'
import { proxyToNetworkBackend } from '../../../../lib/network/backendProxy'

export const dynamic = 'force-dynamic'
export const maxDuration = 180
type Context = { params: { path: string[] } }
export async function GET(request: NextRequest, context: Context) { return proxyToNetworkBackend(request, context.params.path) }
export async function POST(request: NextRequest, context: Context) { return proxyToNetworkBackend(request, context.params.path) }
export async function PUT(request: NextRequest, context: Context) { return proxyToNetworkBackend(request, context.params.path) }
export async function DELETE(request: NextRequest, context: Context) { return proxyToNetworkBackend(request, context.params.path) }
