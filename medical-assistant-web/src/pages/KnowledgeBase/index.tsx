import { useEffect, useState } from 'react';
import {
  Card, Table, Button, Modal, Upload, Tag, Space, Popconfirm,
  Empty, Typography, message,
} from 'antd';
import {
  DeleteOutlined, FileTextOutlined,
  InboxOutlined, EyeOutlined, ReloadOutlined,
  CloudUploadOutlined,
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import type { UploadFile, RcFile } from 'antd/es/upload';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import {
  fetchDocuments, deleteDocuments, ingestFile, previewFile,
  clearPreview, clearError,
} from '@/store/slices/knowledgeBase.slice';
import type { DocumentInfo } from '@/api/knowledgeBase';

const { Dragger } = Upload;
const { Text, Paragraph } = Typography;
const ALLOWED_EXTENSIONS = ['.txt', '.md', '.pdf'];

export default function KnowledgeBase() {
  const dispatch = useAppDispatch();
  const { documents, loading, preview, previewLoading, uploading, error } =
    useAppSelector((s) => s.knowledgeBase);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [messageApi, contextHolder] = message.useMessage();

  useEffect(() => {
    dispatch(fetchDocuments());
  }, [dispatch]);

  useEffect(() => {
    if (error) {
      messageApi.error(error);
      dispatch(clearError());
    }
  }, [error, messageApi, dispatch]);

  const handleBeforeUpload = (file: RcFile): false => {
    const ext = '.' + file.name.split('.').pop()?.toLowerCase();
    if (!ALLOWED_EXTENSIONS.includes(ext)) {
      messageApi.error(`不支持的文件类型: ${ext}，仅支持 ${ALLOWED_EXTENSIONS.join(', ')}`);
      return false;
    }
    setSelectedFile(file);
    return false;
  };

  const handleRemoveFile = () => {
    setSelectedFile(null);
    dispatch(clearPreview());
  };

  const handleIngest = async () => {
    if (!selectedFile) return;
    try {
      await dispatch(ingestFile(selectedFile)).unwrap();
      messageApi.success(`"${selectedFile.name}" 入库成功！`);
      setSelectedFile(null);
      dispatch(fetchDocuments());
    } catch {
      // error handled by useEffect
    }
  };

  const handlePreview = async () => {
    if (!selectedFile) return;
    await dispatch(previewFile(selectedFile));
    setPreviewOpen(true);
  };

  const handleDelete = async (record: DocumentInfo) => {
    await dispatch(deleteDocuments(record.ids)).unwrap();
    messageApi.success(`已删除: ${record.filename}`);
    dispatch(fetchDocuments());
  };

  const handleRefresh = () => dispatch(fetchDocuments());

  const columns: ColumnsType<DocumentInfo> = [
    {
      title: '文件名',
      dataIndex: 'filename',
      key: 'filename',
      render: (text: string) => (
        <Space>
          <FileTextOutlined className="text-blue-500" />
          <Text strong>{text}</Text>
        </Space>
      ),
    },
    {
      title: '分段数',
      dataIndex: 'chunks',
      key: 'chunks',
      width: 100,
      render: (n: number) => <Tag color="blue">{n}</Tag>,
    },
    {
      title: '源路径',
      dataIndex: 'source',
      key: 'source',
      ellipsis: true,
      render: (text: string) => <Text type="secondary" className="text-xs">{text}</Text>,
    },
    {
      title: '操作',
      key: 'actions',
      width: 120,
      render: (_: unknown, record: DocumentInfo) => (
        <Popconfirm
          title="确认删除"
          description={`确定要删除 "${record.filename}" 的所有 ${record.chunks} 个分段吗？`}
          onConfirm={() => handleDelete(record)}
          okText="删除"
          cancelText="取消"
          okButtonProps={{ danger: true }}
        >
          <Button type="text" danger icon={<DeleteOutlined />} size="small">
            删除
          </Button>
        </Popconfirm>
      ),
    },
  ];

  return (
    <div>
      {contextHolder}
      <h2 className="text-2xl font-semibold mb-4">知识库管理</h2>

      <Card className="mb-6">
        <Dragger
          accept={ALLOWED_EXTENSIONS.join(',')}
          beforeUpload={handleBeforeUpload}
          onRemove={handleRemoveFile}
          maxCount={1}
          fileList={selectedFile ? [
            { uid: '-1', name: selectedFile.name, status: 'done' } as UploadFile,
          ] : []}
          showUploadList={{ showPreviewIcon: false }}
          disabled={uploading}
        >
          <p className="text-4xl text-gray-300 mb-2">
            <InboxOutlined />
          </p>
          <p className="text-base">点击或拖拽文件到此区域上传</p>
          <p className="text-gray-400 text-sm">
            支持 .txt / .md / .pdf 格式
          </p>
        </Dragger>

        {selectedFile && (
          <div className="flex gap-3 mt-4">
            <Button
              type="primary"
              icon={<CloudUploadOutlined />}
              onClick={handleIngest}
              loading={uploading}
            >
              开始入库
            </Button>
            <Button
              icon={<EyeOutlined />}
              onClick={handlePreview}
              loading={previewLoading}
            >
              预览分段
            </Button>
            <Button onClick={handleRemoveFile} disabled={uploading || previewLoading}>
              取消
            </Button>
          </div>
        )}
      </Card>

      <Card
        title="已入库文档"
        extra={
          <Button icon={<ReloadOutlined />} onClick={handleRefresh} loading={loading}>
            刷新
          </Button>
        }
      >
        <Table<DocumentInfo>
          columns={columns}
          dataSource={documents}
          rowKey="source"
          loading={loading}
          locale={{ emptyText: <Empty description="暂无文档，请上传知识库文件" /> }}
          pagination={documents.length > 10 ? { pageSize: 10, showTotal: (t: number) => `共 ${t} 条` } : false}
        />
      </Card>

      <Modal
        title={preview ? `预览: ${preview.fileName ?? preview.source}` : '预览分段结果'}
        open={previewOpen}
        onCancel={() => { setPreviewOpen(false); dispatch(clearPreview()); }}
        footer={null}
        width={720}
      >
        {previewLoading ? (
          <div className="text-center py-8 text-gray-400">正在分析文档...</div>
        ) : preview ? (
          <div>
            <p className="mb-3 text-gray-500">
              共 {preview.chunks} 个分段
            </p>
            <div className="max-h-96 overflow-auto space-y-3">
              {preview.preview.map((chunk) => (
                <Card key={chunk.index} size="small" className="bg-gray-50">
                  <div className="flex justify-between items-center mb-1">
                    <Tag color="blue">#{chunk.index + 1}</Tag>
                    <Text type="secondary" className="text-xs">{chunk.charCount} 字符</Text>
                  </div>
                  <Paragraph
                    ellipsis={{ rows: 4, expandable: true, symbol: '展开' }}
                    className="text-sm mb-0"
                  >
                    {chunk.content}
                  </Paragraph>
                </Card>
              ))}
            </div>
          </div>
        ) : null}
      </Modal>
    </div>
  );
}
