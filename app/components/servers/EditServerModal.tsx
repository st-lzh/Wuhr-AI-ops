'use client'

import React from 'react'
import { ServerInfo } from '../../types/access-management'
import ServerFormModal from './ServerFormModal'

interface EditServerModalProps {
  visible: boolean
  server: ServerInfo | null
  onCancel: () => void
  onSuccess: (server: ServerInfo) => void
  onDelete?: (serverId: string) => void
}

const EditServerModal: React.FC<EditServerModalProps> = ({
  visible,
  server,
  onCancel,
  onSuccess,
  onDelete
}) => {
  return (
    <ServerFormModal
      visible={visible}
      mode="edit"
      server={server}
      onCancel={onCancel}
      onSuccess={onSuccess}
      onDelete={onDelete}
    />
  )
}

export default EditServerModal
