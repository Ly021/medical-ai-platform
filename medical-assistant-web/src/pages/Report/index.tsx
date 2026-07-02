import { Card, Upload, Divider } from 'antd';
import { InboxOutlined } from '@ant-design/icons';

const { Dragger } = Upload;

export default function Report() {
  return (
    <div>
      <h2 className="text-2xl font-semibold mb-6">诊疗报告解读</h2>

      <Card title="上传诊疗报告">
        <Dragger
          accept=".pdf,.jpg,.jpeg,.png,.dcm"
          multiple
          action="/api/upload"
        >
          <p className="ant-upload-drag-icon">
            <InboxOutlined />
          </p>
          <p className="ant-upload-text">点击或拖拽文件到此区域上传</p>
          <p className="ant-upload-hint">
            支持 PDF、图片（JPG/PNG）及 DICOM 格式
          </p>
        </Dragger>
      </Card>

      <Divider />

      <Card title="解读结果">
        <div className="text-center text-gray-400 py-12">
          暂无解读结果，请先上传报告
        </div>
      </Card>
    </div>
  );
}
