import { Card, Row, Col, Statistic } from 'antd';
import { FileTextOutlined, MessageOutlined, UserOutlined } from '@ant-design/icons';

export default function Home() {
  return (
    <div>
      <h2 className="text-2xl font-semibold mb-6">概览</h2>
      <Row gutter={[16, 16]}>
        <Col xs={24} sm={8}>
          <Card>
            <Statistic
              title="今日报告解读"
              value={12}
              prefix={<FileTextOutlined />}
              valueStyle={{ color: '#1677ff' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card>
            <Statistic
              title="健康问答"
              value={36}
              prefix={<MessageOutlined />}
              valueStyle={{ color: '#52c41a' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card>
            <Statistic
              title="在线患者"
              value={8}
              prefix={<UserOutlined />}
              valueStyle={{ color: '#faad14' }}
            />
          </Card>
        </Col>
      </Row>

      <Card title="快速入口" className="mt-6">
        <p>欢迎使用智能医生助手平台，请通过左侧菜单选择功能。</p>
      </Card>
    </div>
  );
}
