import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { Layout, Menu } from 'antd';
import type { MenuProps } from 'antd';
import {
  HomeOutlined,
  FileTextOutlined,
  MessageOutlined,
  DatabaseOutlined,
} from '@ant-design/icons';

const { Header, Content, Sider } = Layout;

const menuItems: MenuProps['items'] = [
  { key: '/', icon: <HomeOutlined />, label: '首页' },
  { key: '/report', icon: <FileTextOutlined />, label: '诊疗报告解读' },
  { key: '/health-qa', icon: <MessageOutlined />, label: '健康问答' },
  { key: '/knowledge-base', icon: <DatabaseOutlined />, label: '知识库管理' },
];

export default function MainLayout() {
  const navigate = useNavigate();
  const location = useLocation();

  return (
    <Layout className="min-h-screen">
      <Sider breakpoint="lg" collapsedWidth="0">
        <div className="h-8 m-4 text-white text-lg font-bold text-center leading-8">
          🏥 智能客服
        </div>
        <Menu
          theme="dark"
          mode="inline"
          selectedKeys={[location.pathname]}
          items={menuItems}
          onClick={({ key }) => navigate(key)}
        />
      </Sider>
      <Layout>
        <Header className="bg-white px-6 text-xl font-semibold border-b border-gray-200 flex items-center">
          智能客服
        </Header>
        <Content className="m-6">
          <Outlet />
        </Content>
      </Layout>
    </Layout>
  );
}
