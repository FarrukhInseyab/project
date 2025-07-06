import React, { useState, useEffect } from 'react';
import { 
  BarChart3, 
  FileText, 
  Folder, 
  TrendingUp, 
  Clock, 
  Star,
  Search,
  Filter,
  Calendar,
  Tag,
  Download,
  Upload,
  Users,
  Activity,
  PieChart,
  ArrowUpRight,
  ArrowDownRight,
  Eye,
  Edit,
  Trash2,
  User,
  CheckCircle
} from 'lucide-react';
import { DocumentTemplate } from '../types';
import { TemplateService } from '../services/templateService';
import { ActivityService } from '../services/activityService';
import { ActivityModal } from './ActivityModal';

interface DashboardProps {
  templates: DocumentTemplate[];
  onTemplateSelect: (template: DocumentTemplate) => void;
  onTemplateDelete: (templateId: string) => void;
  onNewTemplate: () => void;
}

export const Dashboard: React.FC<DashboardProps> = ({
  templates,
  onTemplateSelect,
  onTemplateDelete,
  onNewTemplate,
}) => {
  const [timeRange, setTimeRange] = useState<'7d' | '30d' | '90d'>('30d');
  const [stats, setStats] = useState<any>(null);
  const [recentActivity, setRecentActivity] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showActivityModal, setShowActivityModal] = useState(false);

  useEffect(() => {
    loadDashboardData();
  }, [timeRange]);

  const loadDashboardData = async () => {
    try {
      setLoading(true);
      
      // Load template statistics
      const templateStats = await TemplateService.getTemplateStats();
      setStats(templateStats);

      // Load recent activity
      const activity = await ActivityService.getRecentActivity(10);
      setRecentActivity(activity);
    } catch (error) {
      console.error('Failed to load dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  // Calculate statistics from templates
  const calculatedStats = {
    totalTemplates: templates.length,
    totalTags: stats?.totalTags || 0,
    avgTagsPerTemplate: templates.length > 0 ? Math.round((stats?.totalTags || 0) / templates.length) : 0,
    recentTemplates: templates.filter(t => {
      const daysDiff = (new Date().getTime() - new Date(t.createdAt).getTime()) / (1000 * 3600 * 24);
      return daysDiff <= 7;
    }).length,
    totalGenerations: stats?.totalGenerations || 0
  };

  // Get template categories
  const categories = templates.reduce((acc, template) => {
    const category = template.category ? template.category.name : 'Uncategorized';
    acc[category] = (acc[category] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  // Recent templates
  const recentTemplates = templates
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
    .slice(0, 5);

  // Popular templates (mock data - in real app would be based on usage)
  const popularTemplates = templates
    .sort((a, b) => (b.tags?.length || 0) - (a.tags?.length || 0))
    .slice(0, 3);

  const formatDate = (date: Date | string) => {
    if (!date) return 'N/A';
    
    const d = new Date(date);
    if (isNaN(d.getTime())) {
      return 'N/A';
    }
    
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }).format(d);
  };

  const formatActivityType = (type: string) => {
    switch (type) {
      case 'template_created': return 'Created template';
      case 'template_updated': return 'Updated template';
      case 'template_deleted': return 'Deleted template';
      case 'template_used': return 'Used template';
      case 'document_generated': return 'Generated document';
      case 'login': return 'Signed in';
      default: return type;
    }
  };

  const getActivityIcon = (type: string) => {
    switch (type) {
      case 'template_created':
      case 'template_updated':
      case 'template_used':
        return <FileText className="w-4 h-4 text-blue-600" />;
      case 'document_generated':
        return <Download className="w-4 h-4 text-green-600" />;
      case 'tag_created':
      case 'tag_updated':
        return <Tag className="w-4 h-4 text-purple-600" />;
      case 'login':
        return <User className="w-4 h-4 text-gray-600" />;
      default:
        return <Activity className="w-4 h-4 text-gray-600" />;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <>
      <div className="space-y-6">
        {/* Header */}
        <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-xl border border-gray-200/50 p-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-4 sm:space-y-0">
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
                Dashboard
              </h1>
              <p className="text-gray-600 mt-1">Overview of your document processing activities</p>
            </div>
            <div className="flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-3">
              <select
                value={timeRange}
                onChange={(e) => setTimeRange(e.target.value as '7d' | '30d' | '90d')}
                className="px-4 py-2 border border-gray-300 rounded-xl shadow-sm focus:ring-blue-500 focus:border-blue-500 text-sm"
              >
                <option value="7d">Last 7 days</option>
                <option value="30d">Last 30 days</option>
                <option value="90d">Last 90 days</option>
              </select>
            </div>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
          <StatCard
            title="Total Templates"
            value={calculatedStats.totalTemplates}
            icon={<Folder className="w-6 h-6" />}
            color="blue"
            trend={calculatedStats.recentTemplates > 0 ? `+${calculatedStats.recentTemplates} this week` : 'No new templates'}
            trendUp={calculatedStats.recentTemplates > 0}
          />
          <StatCard
            title="Total Tags"
            value={calculatedStats.totalTags}
            icon={<Tag className="w-6 h-6" />}
            color="emerald"
            trend={`${calculatedStats.avgTagsPerTemplate} avg per template`}
            trendUp={true}
          />
          <StatCard
            title="Categories"
            value={Object.keys(categories).length}
            icon={<PieChart className="w-6 h-6" />}
            color="purple"
            trend="Well organized"
            trendUp={true}
          />
          <StatCard
            title="Recent Activity"
            value={recentActivity.length}
            icon={<Activity className="w-6 h-6" />}
            color="orange"
            trend="Last 24 hours"
            trendUp={recentActivity.length > 0}
          />
        </div>

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Recent Templates */}
          <div className="lg:col-span-2">
            <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-xl border border-gray-200/50">
              <div className="border-b border-gray-200/50 p-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className="w-8 h-8 bg-gradient-to-r from-blue-500 to-indigo-600 rounded-xl flex items-center justify-center">
                      <Clock className="w-4 h-4 text-white" />
                    </div>
                    <h2 className="text-lg font-bold text-gray-900">Recent Templates</h2>
                  </div>
                  <button className="text-sm text-blue-600 hover:text-blue-800 font-medium">
                    View all
                  </button>
                </div>
              </div>
              <div className="p-6">
                {recentTemplates.length === 0 ? (
                  <div className="text-center py-8">
                    <div className="w-12 h-12 bg-gray-100 rounded-2xl flex items-center justify-center mx-auto mb-3">
                      <FileText className="w-6 h-6 text-gray-400" />
                    </div>
                    <p className="text-gray-500 text-sm">No templates created yet</p>
                    <button
                      onClick={onNewTemplate}
                      className="mt-3 text-blue-600 hover:text-blue-800 text-sm font-medium"
                    >
                      Create your first template
                    </button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {recentTemplates.map((template) => (
                      <div
                        key={template.id}
                        className="flex items-center justify-between p-4 border border-gray-200 rounded-xl hover:shadow-md transition-all duration-200 group"
                      >
                        <div className="flex items-center space-x-3 flex-1">
                          <div className="w-10 h-10 bg-gradient-to-r from-blue-100 to-indigo-100 rounded-xl flex items-center justify-center">
                            <FileText className="w-5 h-5 text-blue-600" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center space-x-2">
                              <h3 className="font-semibold text-gray-900 truncate">{template.name}</h3>
                              {template.isDefault && (
                                <Star className="w-4 h-4 text-yellow-500 fill-current" />
                              )}
                            </div>
                            <div className="flex items-center space-x-3 text-sm text-gray-500">
                              <span>{template.tags?.length || 0} tags</span>
                              <span>•</span>
                              <span>{formatDate(template.updatedAt)}</span>
                              {template.category && (
                                <>
                                  <span>•</span>
                                  <span className="text-blue-600">{template.category.name}</span>
                                </>
                              )}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center space-x-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                          <button
                            onClick={() => onTemplateSelect(template)}
                            className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-all duration-200"
                            title="Use template"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => onTemplateDelete(template.id)}
                            className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-all duration-200"
                            title="Delete template"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Quick Actions */}
            <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-xl border border-gray-200/50 p-6">
              <h3 className="text-lg font-bold text-gray-900 mb-4">Quick Actions</h3>
              <div className="space-y-3">
                <button
                  onClick={onNewTemplate}
                  className="w-full flex items-center space-x-3 p-3 text-left border border-gray-200 rounded-xl hover:shadow-md hover:border-blue-300 transition-all duration-200 group"
                >
                  <div className="w-8 h-8 bg-gradient-to-r from-blue-500 to-indigo-600 rounded-lg flex items-center justify-center">
                    <Upload className="w-4 h-4 text-white" />
                  </div>
                  <div>
                    <div className="font-semibold text-gray-900 group-hover:text-blue-600">Upload Document</div>
                    <div className="text-sm text-gray-500">Start with a new Word file</div>
                  </div>
                </button>
              </div>
            </div>

            {/* Categories */}
            <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-xl border border-gray-200/50 p-6">
              <h3 className="text-lg font-bold text-gray-900 mb-4">Categories</h3>
              {Object.keys(categories).length === 0 ? (
                <p className="text-gray-500 text-sm">No categories yet</p>
              ) : (
                <div className="space-y-2">
                  {Object.entries(categories).map(([category, count]) => (
                    <div key={category} className="flex items-center justify-between">
                      <span className="text-gray-700">{category}</span>
                      <span className="text-sm text-gray-500 bg-gray-100 px-2 py-1 rounded-full">
                        {count}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Popular Templates */}
            {popularTemplates.length > 0 && (
              <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-xl border border-gray-200/50 p-6">
                <h3 className="text-lg font-bold text-gray-900 mb-4">Most Complex</h3>
                <div className="space-y-3">
                  {popularTemplates.map((template) => (
                    <div
                      key={template.id}
                      className="flex items-center space-x-3 p-3 border border-gray-200 rounded-xl hover:shadow-md transition-all duration-200 cursor-pointer"
                      onClick={() => onTemplateSelect(template)}
                    >
                      <div className="w-8 h-8 bg-gradient-to-r from-purple-100 to-pink-100 rounded-lg flex items-center justify-center">
                        <Star className="w-4 h-4 text-purple-600" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-semibold text-gray-900 truncate text-sm">{template.name}</div>
                        <div className="text-xs text-gray-500">{template.tags?.length || 0} tags</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Recent Activity */}
        {recentActivity.length > 0 && (
          <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-xl border border-gray-200/50">
            <div className="border-b border-gray-200/50 p-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="w-8 h-8 bg-gradient-to-r from-orange-500 to-red-600 rounded-xl flex items-center justify-center">
                    <Activity className="w-4 h-4 text-white" />
                  </div>
                  <h2 className="text-lg font-bold text-gray-900">Recent Activity</h2>
                </div>
                <button 
                  onClick={() => setShowActivityModal(true)}
                  className="text-sm text-blue-600 hover:text-blue-800 font-medium"
                >
                  View all activity
                </button>
              </div>
            </div>
            <div className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {recentActivity.slice(0, 6).map((activity) => (
                  <div key={activity.id} className="flex items-center space-x-3 p-4 bg-white rounded-xl border border-gray-200 hover:shadow-md transition-all duration-200">
                    <div className="w-10 h-10 bg-gradient-to-r from-blue-100 to-indigo-100 rounded-xl flex items-center justify-center flex-shrink-0">
                      {getActivityIcon(activity.activity_type)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1">
                        <p className="font-medium text-gray-900 text-sm truncate">
                          {formatActivityType(activity.activity_type)}
                        </p>
                        <p className="text-xs text-gray-500 flex-shrink-0 ml-2">
                          {formatDate(activity.created_at)}
                        </p>
                      </div>
                      {activity.details?.template_name && (
                        <p className="text-xs text-gray-600 truncate">
                          {activity.details.template_name}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
              
              {recentActivity.length > 6 && (
                <div className="mt-4 text-center">
                  <button 
                    onClick={() => setShowActivityModal(true)}
                    className="text-sm text-blue-600 hover:text-blue-800 font-medium"
                  >
                    View all activity
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Activity Modal */}
      <ActivityModal 
        isOpen={showActivityModal}
        onClose={() => setShowActivityModal(false)}
      />
    </>
  );
};

interface StatCardProps {
  title: string;
  value: number;
  icon: React.ReactNode;
  color: 'blue' | 'emerald' | 'purple' | 'orange';
  trend: string;
  trendUp: boolean;
}

const StatCard: React.FC<StatCardProps> = ({ title, value, icon, color, trend, trendUp }) => {
  const colorClasses = {
    blue: 'from-blue-500 to-blue-600',
    emerald: 'from-emerald-500 to-emerald-600',
    purple: 'from-purple-500 to-purple-600',
    orange: 'from-orange-500 to-orange-600'
  };

  return (
    <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-xl border border-gray-200/50 p-6 hover:shadow-2xl transition-all duration-300">
      <div className="flex items-center justify-between mb-4">
        <div className={`w-10 h-10 bg-gradient-to-r ${colorClasses[color]} rounded-xl flex items-center justify-center text-white`}>
          {icon}
        </div>
        {trendUp ? (
          <ArrowUpRight className="w-4 h-4 text-green-500" />
        ) : (
          <ArrowDownRight className="w-4 h-4 text-gray-400" />
        )}
      </div>
      <div className="space-y-1">
        <h3 className="text-sm font-medium text-gray-600">{title}</h3>
        <div className="text-2xl font-bold text-gray-900">{value.toLocaleString()}</div>
        <p className={`text-xs ${trendUp ? 'text-green-600' : 'text-gray-500'}`}>
          {trend}
        </p>
      </div>
    </div>
  );
};