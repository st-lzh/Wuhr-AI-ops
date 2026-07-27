'use client'

import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { Button, Card, Col, Form, Input, Modal, Popconfirm, Row, Select, Space, Table, Tag, Typography, message } from 'antd'
import { DeleteOutlined, EditOutlined, PlusOutlined } from '@ant-design/icons'
import MainLayout from '../../components/layout/MainLayout'
import NetworkPageHeader from '../../components/network/NetworkPageHeader'
import { usePermissions } from '../../hooks/usePermissions'
import type { NetworkDevice, NetworkGroup } from '../../types/network'
import { deleteNetwork, networkRequest, postNetwork, putNetwork } from '../../utils/networkClient'

export default function NetworkGroupsPage(){
  const {canAccessNetwork}=usePermissions();const canWrite=canAccessNetwork('write')
  const [groups,setGroups]=useState<NetworkGroup[]>([]);const [devices,setDevices]=useState<NetworkDevice[]>([]);const [loading,setLoading]=useState(false);const [open,setOpen]=useState(false);const [editing,setEditing]=useState<NetworkGroup>();const [form]=Form.useForm()
  const load=useCallback(async()=>{setLoading(true);try{const [g,d]=await Promise.all([networkRequest<NetworkGroup[]>('groups'),networkRequest<NetworkDevice[]>('devices')]);setGroups(g??[]);setDevices(d??[])}catch(e:any){message.error(e.message)}finally{setLoading(false)}},[]);useEffect(()=>{load()},[load])
  const counts=useMemo(()=>Object.fromEntries(groups.map(g=>[g.id,devices.filter(d=>d.groupId===g.id).length])),[groups,devices])
  const edit=(g?:NetworkGroup)=>{setEditing(g);form.resetFields();if(g)form.setFieldsValue(g);else form.setFieldsValue({color:'#1677ff',environment:'production',tags:[]});setOpen(true)}
  const save=async()=>{try{const value=await form.validateFields();if(editing)await putNetwork(`groups/${editing.id}`,value);else await postNetwork('groups',value);message.success('设备分组已持久化');setOpen(false);load()}catch(e:any){if(!e?.errorFields)message.error(e.message)}}
  const remove=async(id:string)=>{try{await deleteNetwork(`groups/${id}`);message.success('分组已删除，原设备已转为未分组');load()}catch(e:any){message.error(e.message)}}
  return <MainLayout><div className="p-6"><NetworkPageHeader title="设备分组" description="分组不仅用于列表管理，也直接驱动 AI 输入框中的 @生产网络 等批量目标解析。" onRefresh={load} loading={loading} action={canWrite?<Button type="primary" icon={<PlusOutlined/>} onClick={()=>edit()}>新建设备组</Button>:null}/>
    <Row gutter={[16,16]} className="mb-4"><Col xs={24} md={8}><Card><Typography.Text type="secondary">分组数量</Typography.Text><Typography.Title level={3}>{groups.length}</Typography.Title></Card></Col><Col xs={24} md={8}><Card><Typography.Text type="secondary">已分组设备</Typography.Text><Typography.Title level={3}>{devices.filter(d=>d.groupId).length}</Typography.Title></Card></Col><Col xs={24} md={8}><Card><Typography.Text type="secondary">未分组设备</Typography.Text><Typography.Title level={3}>{devices.filter(d=>!d.groupId).length}</Typography.Title></Card></Col></Row>
    <Card><Table rowKey="id" loading={loading} dataSource={groups} columns={[{title:'分组名称',dataIndex:'name',render:(v:string,r:NetworkGroup)=><Space><span className="inline-block h-3 w-3 rounded-full" style={{background:r.color||'#1677ff'}}/>{v}</Space>},{title:'所属环境',dataIndex:'environment',render:(v:string)=><Tag color={v==='production'?'red':'blue'}>{v||'未设置'}</Tag>},{title:'设备数量',render:(_:unknown,r:NetworkGroup)=>counts[r.id]||0},{title:'标签',dataIndex:'tags',render:(tags:string[])=><Space wrap>{(tags||[]).map(t=><Tag key={t}>{t}</Tag>)}</Space>},{title:'说明',dataIndex:'description'},{title:'操作',width:130,render:(_:unknown,r:NetworkGroup)=><Space><Button size="small" icon={<EditOutlined/>} disabled={!canWrite} onClick={()=>edit(r)}/><Popconfirm title="删除该分组？" onConfirm={()=>remove(r.id)}><Button size="small" danger icon={<DeleteOutlined/>} disabled={!canWrite}/></Popconfirm></Space>}]}/></Card>
    <Modal open={open} title={editing?'编辑设备组':'新建设备组'} onCancel={()=>setOpen(false)} onOk={save}><Form form={form} layout="vertical"><Form.Item name="name" label="分组名称" rules={[{required:true}]}><Input placeholder="生产核心网络"/></Form.Item><Form.Item name="environment" label="所属环境"><Select options={[{value:'production',label:'生产环境'},{value:'staging',label:'预发环境'},{value:'development',label:'开发环境'},{value:'lab',label:'实验环境'}]}/></Form.Item><Form.Item name="color" label="标识颜色"><Input type="color"/></Form.Item><Form.Item name="tags" label="分组标签"><Select mode="tags" tokenSeparators={[',']}/></Form.Item><Form.Item name="description" label="说明"><Input.TextArea rows={3}/></Form.Item></Form></Modal>
  </div></MainLayout>
}
