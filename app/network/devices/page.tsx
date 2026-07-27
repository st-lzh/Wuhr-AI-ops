'use client'

import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { Alert, Button, Card, Col, Descriptions, Drawer, Form, Input, InputNumber, Modal, Popconfirm, Row, Select, Space, Switch, Table, Tag, Tooltip, Typography, message } from 'antd'
import { DeleteOutlined, EditOutlined, PlusOutlined, SafetyCertificateOutlined, ThunderboltOutlined } from '@ant-design/icons'
import MainLayout from '../../components/layout/MainLayout'
import NetworkPageHeader from '../../components/network/NetworkPageHeader'
import { usePermissions } from '../../hooks/usePermissions'
import type { NetworkDevice, NetworkDeviceInput, NetworkGroup } from '../../types/network'
import { deleteNetwork, networkRequest, postNetwork, putNetwork } from '../../utils/networkClient'

const vendors = ['huawei','h3c','cisco','ruijie','maipu','juniper','arista','fortinet','paloalto','other']
const deviceTypes = [{value:'switch',label:'交换机'},{value:'router',label:'路由器'},{value:'firewall',label:'防火墙'},{value:'load_balancer',label:'负载均衡'},{value:'wireless_controller',label:'无线控制器'}]
const statusColor: Record<string,string> = { online:'green',offline:'red',warning:'orange',error:'red',unknown:'default',maintenance:'blue' }

export default function NetworkDevicesPage() {
  const { canAccessNetwork } = usePermissions()
  const canWrite = canAccessNetwork('write')
  const [devices,setDevices]=useState<NetworkDevice[]>([])
  const [groups,setGroups]=useState<NetworkGroup[]>([])
  const [loading,setLoading]=useState(false)
  const [saving,setSaving]=useState(false)
  const [testing,setTesting]=useState<string>()
  const [modalOpen,setModalOpen]=useState(false)
  const [editing,setEditing]=useState<NetworkDevice>()
  const [detail,setDetail]=useState<NetworkDevice>()
  const [form]=Form.useForm<NetworkDeviceInput>()

  const load=useCallback(async()=>{setLoading(true);try{const [d,g]=await Promise.all([networkRequest<NetworkDevice[]>('devices'),networkRequest<NetworkGroup[]>('groups')]);setDevices(d??[]);setGroups(g??[])}catch(e:any){message.error(e.message)}finally{setLoading(false)}},[])
  useEffect(()=>{load()},[load])

  const openCreate=()=>{setEditing(undefined);form.resetFields();form.setFieldsValue({port:22,type:'switch',vendor:'huawei',platform:'vrp',authType:'password',connectionMethod:'ssh',environment:'production',readOnly:true,tags:[],capabilities:{ssh:true,netconf:false,restconf:false,gnmi:false,snmp:false,configBackup:true,candidateConfig:false,commitConfirm:false,automaticRollback:false}} as any);setModalOpen(true)}
  const openEdit=(d:NetworkDevice)=>{setEditing(d);form.setFieldsValue({...d,password:undefined} as any);setModalOpen(true)}
  const save=async()=>{try{const values=await form.validateFields();setSaving(true);if(editing){await putNetwork(`devices/${editing.id}`,values);message.success('设备信息已保存')}else{await postNetwork('devices',values);message.success('设备已添加，建议立即测试连接')};setModalOpen(false);await load()}catch(e:any){if(e?.errorFields)return;message.error(e.message)}finally{setSaving(false)}}
  const test=async(d:NetworkDevice)=>{setTesting(d.id);try{const result=await postNetwork<{output:string;durationMs:number}>(`devices/${d.id}/test`,{});Modal.success({title:'连接和版本查询成功',width:760,content:<><Typography.Paragraph>耗时 {result.durationMs} ms</Typography.Paragraph><pre className="max-h-80 overflow-auto whitespace-pre-wrap rounded bg-slate-950 p-3 text-xs text-slate-100">{result.output}</pre></>});await load()}catch(e:any){Modal.error({title:'连接测试失败',content:e.message});await load()}finally{setTesting(undefined)}}
  const remove=async(id:string)=>{try{await deleteNetwork(`devices/${id}`);message.success('设备已删除');await load()}catch(e:any){message.error(e.message)}}
  const stats=useMemo(()=>({online:devices.filter(d=>d.status==='online').length,offline:devices.filter(d=>d.status==='offline').length,readonly:devices.filter(d=>d.readOnly).length}),[devices])

  return <MainLayout><div className="p-6">
    <NetworkPageHeader title="设备资产" description="统一管理路由器、交换机、防火墙及其真实连接能力。" onRefresh={load} loading={loading} action={canWrite?<Button type="primary" icon={<PlusOutlined/>} onClick={openCreate}>添加设备</Button>:null}/>
    <Row gutter={[16,16]} className="mb-4"><Col xs={12} md={6}><Card><Typography.Text type="secondary">设备总数</Typography.Text><Typography.Title level={3}>{devices.length}</Typography.Title></Card></Col><Col xs={12} md={6}><Card><Typography.Text type="secondary">在线设备</Typography.Text><Typography.Title level={3} style={{color:'#16a34a'}}>{stats.online}</Typography.Title></Card></Col><Col xs={12} md={6}><Card><Typography.Text type="secondary">离线设备</Typography.Text><Typography.Title level={3} type="danger">{stats.offline}</Typography.Title></Card></Col><Col xs={12} md={6}><Card><Typography.Text type="secondary">只读保护</Typography.Text><Typography.Title level={3}>{stats.readonly}</Typography.Title></Card></Col></Row>
    <Card><Table rowKey="id" loading={loading} dataSource={devices} pagination={{pageSize:10}} scroll={{x:1100}} columns={[
      {title:'设备名称',dataIndex:'name',fixed:'left',width:170,render:(v:string,r:NetworkDevice)=><Button type="link" onClick={()=>setDetail(r)}>{v}</Button>},
      {title:'类型',dataIndex:'type',width:110,render:(v:string)=>deviceTypes.find(x=>x.value===v)?.label||v},
      {title:'厂商/平台',width:150,render:(_:unknown,r:NetworkDevice)=><><div>{r.vendor.toUpperCase()}</div><Typography.Text type="secondary">{r.platform||'-'}</Typography.Text></>},
      {title:'管理地址',width:160,render:(_:unknown,r:NetworkDevice)=><Typography.Text copyable>{r.managementIp}:{r.port}</Typography.Text>},
      {title:'分组',dataIndex:'groupId',width:130,render:(v:string)=>groups.find(g=>g.id===v)?.name||'-'},
      {title:'环境',dataIndex:'environment',width:100,render:(v:string)=><Tag color={v==='production'?'red':'blue'}>{v||'未设置'}</Tag>},
      {title:'状态',dataIndex:'status',width:100,render:(v:string,r:NetworkDevice)=><Tooltip title={r.lastError}><Tag color={statusColor[v]}>{v}</Tag></Tooltip>},
      {title:'标签',dataIndex:'tags',width:180,render:(v:string[])=><Space wrap>{(v||[]).map(x=><Tag key={x}>{x}</Tag>)}</Space>},
      {title:'保护',width:100,render:(_:unknown,r:NetworkDevice)=>r.readOnly?<Tag icon={<SafetyCertificateOutlined/>} color="green">只读</Tag>:<Tag color="orange">可变更</Tag>},
      {title:'操作',fixed:'right',width:190,render:(_:unknown,r:NetworkDevice)=><Space><Button size="small" icon={<ThunderboltOutlined/>} loading={testing===r.id} disabled={!canWrite} onClick={()=>test(r)}>测试</Button><Button size="small" icon={<EditOutlined/>} disabled={!canWrite} onClick={()=>openEdit(r)}/><Popconfirm title="确认删除设备？" description="存在未完成变更时后端会拒绝删除。" onConfirm={()=>remove(r.id)}><Button size="small" danger icon={<DeleteOutlined/>} disabled={!canWrite}/></Popconfirm></Space>},
    ]}/></Card>

    <Modal open={modalOpen} title={editing?'编辑设备':'添加设备'} width={820} onCancel={()=>setModalOpen(false)} onOk={save} confirmLoading={saving} destroyOnClose>
      <Alert type="warning" showIcon className="mb-4" message="凭据安全" description="密码只会发送给 v1 后端并写入加密 secret vault；编辑时密码留空表示保持原凭据。也可以填写后端已有的 secret:// 引用。"/>
      <Form form={form} layout="vertical"><Row gutter={16}><Col span={12}><Form.Item name="name" label="设备名称" rules={[{required:true}]}><Input placeholder="core-sw-01"/></Form.Item></Col><Col span={12}><Form.Item name="displayName" label="显示名称"><Input/></Form.Item></Col><Col span={8}><Form.Item name="type" label="设备类型" rules={[{required:true}]}><Select options={deviceTypes}/></Form.Item></Col><Col span={8}><Form.Item name="vendor" label="设备厂商" rules={[{required:true}]}><Select options={vendors.map(v=>({value:v,label:v.toUpperCase()}))}/></Form.Item></Col><Col span={8}><Form.Item name="platform" label="系统平台" rules={[{required:true}]}><Input placeholder="vrp / comware / iosxe"/></Form.Item></Col><Col span={12}><Form.Item name="managementIp" label="管理 IP" rules={[{required:true}]}><Input placeholder="10.0.0.1"/></Form.Item></Col><Col span={6}><Form.Item name="port" label="SSH 端口"><InputNumber min={1} max={65535} className="w-full"/></Form.Item></Col><Col span={6}><Form.Item name="environment" label="环境"><Select options={[{value:'production',label:'生产环境'},{value:'staging',label:'预发环境'},{value:'development',label:'开发环境'},{value:'lab',label:'实验环境'}]}/></Form.Item></Col><Col span={8}><Form.Item name="authType" label="认证方式"><Select options={[{value:'password',label:'密码认证'},{value:'key',label:'密钥认证'}]}/></Form.Item></Col><Col span={8}><Form.Item name="username" label="登录用户" rules={[{required:true}]}><Input/></Form.Item></Col><Col span={8}><Form.Item name="password" label={editing?'更新密码（可空）':'登录密码'}><Input.Password autoComplete="new-password"/></Form.Item></Col><Col span={12}><Form.Item name="passwordRef" label="密码引用（可替代密码）"><Input placeholder="secret://local/device-password"/></Form.Item></Col><Col span={12}><Form.Item name="keyRef" label="私钥引用"><Input placeholder="secret://file//etc/... 或 secret://local/..."/></Form.Item></Col><Col span={12}><Form.Item name="groupId" label="设备分组"><Select allowClear options={groups.map(g=>({value:g.id,label:g.name}))}/></Form.Item></Col><Col span={12}><Form.Item name="tags" label="标签"><Select mode="tags" tokenSeparators={[',']} /></Form.Item></Col><Col span={12}><Form.Item name="location" label="机房位置"><Input/></Form.Item></Col><Col span={12}><Form.Item name="readOnly" label="只读保护" valuePropName="checked"><Switch checkedChildren="开启" unCheckedChildren="关闭"/></Form.Item></Col><Col span={24}><Form.Item name="description" label="说明"><Input.TextArea rows={2}/></Form.Item></Col></Row></Form>
    </Modal>
    <Drawer open={!!detail} onClose={()=>setDetail(undefined)} title="设备详情" width={620}>{detail&&<><Descriptions bordered column={1} size="small" items={[{key:'name',label:'名称',children:detail.name},{key:'address',label:'管理地址',children:`${detail.managementIp}:${detail.port}`},{key:'vendor',label:'厂商平台',children:`${detail.vendor} / ${detail.platform}`},{key:'credential',label:'凭据状态',children:detail.hasCredential?'已配置（已脱敏）':'未配置'},{key:'last',label:'最后连接',children:detail.lastConnectedAt||'尚未测试'},{key:'error',label:'最后错误',children:detail.lastError||'-'}]}/><Typography.Title level={5} className="mt-5">能力矩阵</Typography.Title><Space wrap>{Object.entries(detail.capabilities||{}).map(([k,v])=><Tag key={k} color={v?'green':'default'}>{k}: {v?'支持':'未验证'}</Tag>)}</Space></>}</Drawer>
  </div></MainLayout>
}
