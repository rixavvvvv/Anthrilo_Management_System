'use client'

import { useEffect, useRef, useCallback, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'

const WS_URL = process.env.NEXT_PUBLIC_WS_URL || 'ws://127.0.0.1:8000/api/v1/integrations/ws/sales'
const RECONNECT_DELAY = 3000
const MAX_RECONNECT_ATTEMPTS = 10

interface WebSocketMessage {
    type: string
    data?: any
    message?: string
}

interface OrderNotification {
    count: number
    totalOrders: number
    totalRevenue: number
    orders?: any[]
}

/**
 * WebSocket hook for real-time dashboard updates.
 * Automatically reconnects and updates React Query cache when new data arrives.
 *
 * Usage:
 *   const { isConnected, lastUpdate, newOrderNotification, dismissNotification } = useWebSocket()
 *
 * When the server pushes today_sales data, the React Query cache
 * for 'unicommerce-today' is automatically updated — no polling needed.
 */
export function useWebSocket() {
    const wsRef = useRef<WebSocket | null>(null)
    const reconnectAttemptsRef = useRef(0)
    const reconnectTimerRef = useRef<ReturnType<typeof setTimeout>>()
    const isMountedRef = useRef(false)
    const queryClient = useQueryClient()
    const [isConnected, setIsConnected] = useState(false)
    const [lastUpdate, setLastUpdate] = useState<Date | null>(null)
    const [newOrderNotification, setNewOrderNotification] = useState<OrderNotification | null>(null)

    const connect = useCallback(() => {
        // Don't connect during SSR or after unmount
        if (typeof window === 'undefined') return
        if (!isMountedRef.current) return

        // Avoid duplicate connections (already open or in the process of connecting)
        const state = wsRef.current?.readyState
        if (state === WebSocket.OPEN || state === WebSocket.CONNECTING) return

        // Stop trying after max attempts
        if (reconnectAttemptsRef.current >= MAX_RECONNECT_ATTEMPTS) {
            if (reconnectAttemptsRef.current === MAX_RECONNECT_ATTEMPTS) {
                console.warn('WebSocket: Max reconnection attempts reached. Backend may be offline.')
                reconnectAttemptsRef.current++ // prevent repeated warnings
            }
            return
        }

        try {
            const ws = new WebSocket(WS_URL)
            wsRef.current = ws

            ws.onopen = () => {
                if (!isMountedRef.current) { ws.close(); return }
                setIsConnected(true)
                reconnectAttemptsRef.current = 0
                console.log('WebSocket: Connected to sales feed')
                ws.send(JSON.stringify({ action: 'subscribe' }))
            }

            ws.onmessage = (event) => {
                if (!isMountedRef.current) return
                try {
                    const msg: WebSocketMessage = JSON.parse(event.data)
                    if (msg.type === 'today_sales' && msg.data) {
                        queryClient.setQueryData(['unicommerce-today'], msg.data)
                        setLastUpdate(new Date())
                    }
                    if (msg.type === 'new_order' && msg.data) {
                        setNewOrderNotification(msg.data)
                        setLastUpdate(new Date())
                    }
                } catch {
                    // Ignore malformed messages
                }
            }

            ws.onclose = () => {
                wsRef.current = null

                // If the component has already unmounted, do not reschedule
                if (!isMountedRef.current) return

                setIsConnected(false)

                if (reconnectAttemptsRef.current < MAX_RECONNECT_ATTEMPTS) {
                    const delay = RECONNECT_DELAY * Math.min(reconnectAttemptsRef.current + 1, 5)
                    if (reconnectAttemptsRef.current === 0) {
                        console.log('WebSocket: Connection closed. Will retry...')
                    }
                    reconnectTimerRef.current = setTimeout(() => {
                        reconnectAttemptsRef.current++
                        connect()
                    }, delay)
                } else {
                    console.warn('WebSocket: Unable to connect. Please ensure the backend is running on port 8000.')
                }
            }

            ws.onerror = () => {
                // Only log the first few errors; onerror is always followed by onclose
                if (reconnectAttemptsRef.current < 3) {
                    console.warn('WebSocket: Connection error — will retry automatically')
                }
                ws.close()
            }
        } catch (error) {
            if (reconnectAttemptsRef.current < 3) {
                console.warn('WebSocket: Failed to create connection', error)
            }
        }
    }, [queryClient])

    useEffect(() => {
        isMountedRef.current = true
        reconnectAttemptsRef.current = 0 // start fresh on each mount
        connect()

        return () => {
            isMountedRef.current = false
            if (reconnectTimerRef.current) {
                clearTimeout(reconnectTimerRef.current)
            }
            // Close without triggering reconnect (onclose checks isMountedRef)
            if (wsRef.current) {
                wsRef.current.close()
                wsRef.current = null
            }
        }
    }, [connect])

    const requestRefresh = useCallback(() => {
        if (wsRef.current?.readyState === WebSocket.OPEN) {
            wsRef.current.send(JSON.stringify({ action: 'refresh' }))
        }
    }, [])

    const dismissNotification = useCallback(() => {
        setNewOrderNotification(null)
    }, [])

    return { isConnected, lastUpdate, requestRefresh, newOrderNotification, dismissNotification }
}
