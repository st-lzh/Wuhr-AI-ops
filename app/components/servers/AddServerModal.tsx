'use client'

import React from 'react'
import { ServerInfo } from '../../types/access-management'
import ServerFormModal from './ServerFormModal'

interface AddServerModalProps {
  visible: boolean
  onCancel: () => void
  onSuccess: (server: ServerInfo) => void
}

const AddServerModal: React.FC<AddServerModalProps> = ({
  visible,
  onCancel,
  onSuccess
}) => {
  return (
    <ServerFormModal
      visible={visible}
      mode="add"
      onCancel={onCancel}
      onSuccess={onSuccess}
    />
  )
}

export default AddServerModal
