'use client'

import React from 'react'
import { Badge } from 'antd'
import { BellOutlined } from '@ant-design/icons'

interface NotificationBellProps {
  count?: number
  onClick?: () => void
  className?: string
}

const NotificationBell: React.FC<NotificationBellProps> = ({ 
  count = 0, 
  onClick,
  className = ''
}) => {
  return (
    <Badge count={count} size="small">
      <BellOutlined
        className={`text-xl cursor-pointer transition-colors ${className}`}
        onClick={onClick}
      />
    </Badge>
  )
}

export default NotificationBell
