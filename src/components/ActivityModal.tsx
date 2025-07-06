import React, { useState, useEffect } from 'react';
import { 
  X, 
  Activity, 
  BarChart3, 
  PieChart, 
  TrendingUp, 
  Calendar, 
  Clock, 
  User, 
  FileText, 
  Download, 
  Tag, 
  Filter,
  Search,
  ChevronDown,
  ChevronUp,
  RefreshCw
} from 'lucide-react';
import { ActivityService } from '../services/activityService';

interface ActivityModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface ActivityData {
  id: string;
  activity_type: string;
  resource_type?: string;
  resource_id?: string;
  details: Record<string, any>;
  created_at: string;
}

interface ActivityStats {
  totalActivities: number;
  byType: Record<string, number>;
  byDay: Record<string, number>;
  recentActivities: ActivityData[];
}

export const ActivityModal: React.FC<ActivityModalProps> = ({ isOpen, onClose }) => {
  const [activities, setActivities] = useState<ActivityData[]>([]);
  const [stats, setStats] = useState<ActivityStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState<'7d' | '30d' | '90d'>('30d');
  const [filterType, setFilterType] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState<'date' | 'type'>('date');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [expandedActivity, setExpandedActivity] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      loadActivityData();
    }
  }, [isOpen, timeRange]);

  const loadActivityData = async () => {
    try {
      setLoading(true);
      
      // Get days based on time range
      const days = timeRange === '7d' ? 7 : timeRange === '30d' ? 30 : 90;
      
      // Load activity stats and recent activities
      const [statsData, activitiesData] = await Promise.all([
        ActivityService.getActivityStats(days),
        ActivityService.getRecentActivity(100) // Get more activities for detailed view
      ]);
      
      setStats(statsData);
      setActivities(activitiesData);
    } catch (error) {
      console.error('Failed to load activity data:', error);
    } finally {
      setLoading(false);
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

  const formatActivityType = (type: string) => {
    switch (type) {
      case 'template_created': return 'Created template';
      case 'template_updated': return 'Updated template';
      case 'template_deleted': return 'Deleted template';
      case 'template_used': return 'Used template';
      case 'document_generated': return 'Generated document';
      case 'data_imported': return 'Imported data';
      case 'tag_created': return 'Created tag';
      case 'tag_updated': return 'Updated tag';
      case 'category_created': return 'Created category';
      case 'login': return 'Signed in';
      case 'export_data': return 'Exported data';
      default: return type;
    }
  };

  const formatDate = (date: string) => {
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }).format(new Date(date));
  };

  const formatFullDate = (date: string) => {
    return new Intl.DateTimeFormat('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    }).format(new Date(date));
  };

  // Filter and sort activities
  const filteredActivities = activities
    .filter(activity => {
      const matchesType = filterType === 'all' || activity.activity_type === filterType;
      const matchesSearch = searchTerm === '' || 
        formatActivityType(activity.activity_type).toLowerCase().includes(searchTerm.toLowerCase()) ||
        activity.details?.template_name?.toLowerCase().includes(searchTerm.toLowerCase());
      return matchesType && matchesSearch;
    })
    .sort((a, b) => {
      if (sortBy === 'date') {
        const dateA = new Date(a.created_at).getTime();
        const dateB = new Date(b.created_at).getTime();
        return sortOrder === 'desc' ? dateB - dateA : dateA - dateB;
      } else {
        const typeA = formatActivityType(a.activity_type);
        const typeB = formatActivityType(b.activity_type);
        return sortOrder === 'desc' ? typeB.localeCompare(typeA) : typeA.localeCompare(typeB);
      }
    });

  // Get unique activity types for filter
  const activityTypes = Array.from(new Set(activities.map(a => a.activity_type)));

  // Chart data preparation
  const chartData = stats ? {
    byType: Object.entries(stats.byType).map(([type, count]) => ({
      name: formatActivityType(type),
      value: count,
      color: getActivityColor(type)
    })),
    byDay: generateDayChart(activities, timeRange)
  } : { byType: [], byDay: [] };

  function getActivityColor(type: string): string {
    switch (type) {
      case 'template_created':
      case 'template_updated':
      case 'template_used':
        return '#3B82F6';
      case 'document_generated':
        return '#10B981';
      case 'tag_created':
      case 'tag_updated':
        return '#8B5CF6';
      case 'login':
        return '#6B7280';
      default:
        return '#9CA3AF';
    }
  }

  function generateDayChart(activities: ActivityData[], range: string) {
    const days = range === '7d' ? 7 : range === '30d' ? 30 : 90;
    const dayData: Record<string, number> = {};
    
    // Initialize all days with 0
    for (let i = days - 1; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const key = date.toISOString().split('T')[0];
      dayData[key] = 0;
    }
    
    // Count activities by day
    activities.forEach(activity => {
      const date = new Date(activity.created_at).toISOString().split('T')[0];
      if (dayData.hasOwnProperty(date)) {
        dayData[date]++;
      }
    });
    
    return Object.entries(dayData).map(([date, count]) => ({
      date: new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      count
    }));
  }

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-2xl shadow-2xl max-w-7xl w-full max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="border-b border-gray-200 p-6 bg-gradient-to-r from-blue-50 to-indigo-50">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="w-12 h-12 bg-gradient-to-r from-blue-500 to-indigo-600 rounded-2xl flex items-center justify-center">
                <BarChart3 className="w-6 h-6 text-white" />
              </div>
              <div>
                <h2 className="text-2xl font-bold text-gray-900">Activity Analytics</h2>
                <p className="text-gray-600">Comprehensive view of your platform activity</p>
              </div>
            </div>
            <div className="flex items-center space-x-3">
              <select
                value={timeRange}
                onChange={(e) => setTimeRange(e.target.value as '7d' | '30d' | '90d')}
                className="px-4 py-2 border border-gray-300 rounded-xl shadow-sm focus:ring-blue-500 focus:border-blue-500 text-sm"
              >
                <option value="7d">Last 7 days</option>
                <option value="30d">Last 30 days</option>
                <option value="90d">Last 90 days</option>
              </select>
              <button
                onClick={loadActivityData}
                disabled={loading}
                className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-xl transition-all duration-200 disabled:opacity-50"
              >
                <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
              </button>
              <button
                onClick={onClose}
                className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-xl transition-all duration-200"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
          </div>
        </div>

        <div className="overflow-y-auto max-h-[calc(90vh-120px)]">
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
            </div>
          ) : (
            <div className="p-6 space-y-6">
              {/* Stats Overview */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-2xl p-6 border border-blue-200">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-blue-600">Total Activities</p>
                      <p className="text-2xl font-bold text-blue-900">{stats?.totalActivities || 0}</p>
                    </div>
                    <Activity className="w-8 h-8 text-blue-600" />
                  </div>
                </div>
                
                <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-2xl p-6 border border-green-200">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-green-600">Documents Generated</p>
                      <p className="text-2xl font-bold text-green-900">{stats?.byType?.document_generated || 0}</p>
                    </div>
                    <Download className="w-8 h-8 text-green-600" />
                  </div>
                </div>
                
                <div className="bg-gradient-to-br from-purple-50 to-purple-100 rounded-2xl p-6 border border-purple-200">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-purple-600">Templates Used</p>
                      <p className="text-2xl font-bold text-purple-900">{stats?.byType?.template_used || 0}</p>
                    </div>
                    <FileText className="w-8 h-8 text-purple-600" />
                  </div>
                </div>
                
                <div className="bg-gradient-to-br from-orange-50 to-orange-100 rounded-2xl p-6 border border-orange-200">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-orange-600">Activity Types</p>
                      <p className="text-2xl font-bold text-orange-900">{Object.keys(stats?.byType || {}).length}</p>
                    </div>
                    <PieChart className="w-8 h-8 text-orange-600" />
                  </div>
                </div>
              </div>

              {/* Charts Section */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Activity by Type Chart */}
                <div className="bg-white rounded-2xl border border-gray-200 p-6">
                  <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center">
                    <PieChart className="w-5 h-5 mr-2 text-blue-600" />
                    Activity by Type
                  </h3>
                  <div className="space-y-3">
                    {chartData.byType.map((item, index) => (
                      <div key={index} className="flex items-center justify-between">
                        <div className="flex items-center space-x-3">
                          <div 
                            className="w-4 h-4 rounded-full"
                            style={{ backgroundColor: item.color }}
                          ></div>
                          <span className="text-sm font-medium text-gray-700">{item.name}</span>
                        </div>
                        <div className="flex items-center space-x-2">
                          <span className="text-sm font-bold text-gray-900">{item.value}</span>
                          <div className="w-20 bg-gray-200 rounded-full h-2">
                            <div 
                              className="h-2 rounded-full"
                              style={{ 
                                backgroundColor: item.color,
                                width: `${(item.value / (stats?.totalActivities || 1)) * 100}%`
                              }}
                            ></div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Activity Timeline Chart */}
                <div className="bg-white rounded-2xl border border-gray-200 p-6">
                  <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center">
                    <TrendingUp className="w-5 h-5 mr-2 text-green-600" />
                    Activity Timeline
                  </h3>
                  <div className="space-y-2">
                    {chartData.byDay.map((item, index) => (
                      <div key={index} className="flex items-center justify-between">
                        <span className="text-xs font-medium text-gray-600 w-12">{item.date}</span>
                        <div className="flex-1 mx-3">
                          <div className="w-full bg-gray-200 rounded-full h-2">
                            <div 
                              className="bg-gradient-to-r from-green-400 to-green-600 h-2 rounded-full transition-all duration-300"
                              style={{ 
                                width: `${item.count > 0 ? Math.max((item.count / Math.max(...chartData.byDay.map(d => d.count))) * 100, 5) : 0}%`
                              }}
                            ></div>
                          </div>
                        </div>
                        <span className="text-xs font-bold text-gray-900 w-6 text-right">{item.count}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Filters and Search */}
              <div className="bg-white rounded-2xl border border-gray-200 p-6">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-4 sm:space-y-0 mb-6">
                  <h3 className="text-lg font-bold text-gray-900 flex items-center">
                    <Activity className="w-5 h-5 mr-2 text-blue-600" />
                    Activity Details ({filteredActivities.length})
                  </h3>
                  
                  <div className="flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-3">
                    {/* Search */}
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                      <input
                        type="text"
                        placeholder="Search activities..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="pl-10 pr-4 py-2 border border-gray-300 rounded-xl shadow-sm focus:ring-blue-500 focus:border-blue-500 text-sm w-full sm:w-48"
                      />
                    </div>

                    {/* Type Filter */}
                    <div className="relative">
                      <Filter className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                      <select
                        value={filterType}
                        onChange={(e) => setFilterType(e.target.value)}
                        className="pl-10 pr-8 py-2 border border-gray-300 rounded-xl shadow-sm focus:ring-blue-500 focus:border-blue-500 text-sm appearance-none bg-white"
                      >
                        <option value="all">All Types</option>
                        {activityTypes.map(type => (
                          <option key={type} value={type}>{formatActivityType(type)}</option>
                        ))}
                      </select>
                    </div>

                    {/* Sort */}
                    <div className="flex space-x-2">
                      <select
                        value={sortBy}
                        onChange={(e) => setSortBy(e.target.value as 'date' | 'type')}
                        className="px-3 py-2 border border-gray-300 rounded-xl shadow-sm focus:ring-blue-500 focus:border-blue-500 text-sm"
                      >
                        <option value="date">Sort by Date</option>
                        <option value="type">Sort by Type</option>
                      </select>
                      <button
                        onClick={() => setSortOrder(sortOrder === 'desc' ? 'asc' : 'desc')}
                        className="px-3 py-2 border border-gray-300 rounded-xl shadow-sm hover:bg-gray-50 transition-colors"
                      >
                        {sortOrder === 'desc' ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                </div>

                {/* Activity Grid */}
                <div className="space-y-3">
                  {filteredActivities.length === 0 ? (
                    <div className="text-center py-8">
                      <Activity className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                      <p className="text-gray-500">No activities found matching your criteria.</p>
                    </div>
                  ) : (
                    filteredActivities.map((activity) => (
                      <div
                        key={activity.id}
                        className="border border-gray-200 rounded-xl p-4 hover:shadow-md transition-all duration-200 bg-white"
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex items-start space-x-3 flex-1">
                            <div className="w-10 h-10 bg-gradient-to-r from-blue-100 to-indigo-100 rounded-xl flex items-center justify-center flex-shrink-0">
                              {getActivityIcon(activity.activity_type)}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center justify-between mb-1">
                                <h4 className="font-semibold text-gray-900 text-sm">
                                  {formatActivityType(activity.activity_type)}
                                </h4>
                                <span className="text-xs text-gray-500">{formatDate(activity.created_at)}</span>
                              </div>
                              
                              {activity.details?.template_name && (
                                <p className="text-sm text-gray-600 mb-1">
                                  Template: <span className="font-medium">{activity.details.template_name}</span>
                                </p>
                              )}
                              
                              {activity.details?.documents_count && (
                                <p className="text-sm text-gray-600 mb-1">
                                  Generated {activity.details.documents_count} document{activity.details.documents_count !== 1 ? 's' : ''}
                                </p>
                              )}
                              
                              {activity.resource_type && (
                                <div className="flex items-center space-x-2 mt-2">
                                  <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-700">
                                    {activity.resource_type}
                                  </span>
                                  {activity.resource_id && (
                                    <span className="text-xs text-gray-500 font-mono">
                                      {activity.resource_id.substring(0, 8)}...
                                    </span>
                                  )}
                                </div>
                              )}
                            </div>
                          </div>
                          
                          <button
                            onClick={() => setExpandedActivity(
                              expandedActivity === activity.id ? null : activity.id
                            )}
                            className="p-1 text-gray-400 hover:text-gray-600 rounded"
                          >
                            {expandedActivity === activity.id ? 
                              <ChevronUp className="w-4 h-4" /> : 
                              <ChevronDown className="w-4 h-4" />
                            }
                          </button>
                        </div>
                        
                        {expandedActivity === activity.id && (
                          <div className="mt-4 pt-4 border-t border-gray-100">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                              <div>
                                <p className="font-medium text-gray-700 mb-1">Full Timestamp:</p>
                                <p className="text-gray-600 font-mono text-xs">{formatFullDate(activity.created_at)}</p>
                              </div>
                              
                              {activity.resource_id && (
                                <div>
                                  <p className="font-medium text-gray-700 mb-1">Resource ID:</p>
                                  <p className="text-gray-600 font-mono text-xs">{activity.resource_id}</p>
                                </div>
                              )}
                              
                              {Object.keys(activity.details).length > 0 && (
                                <div className="md:col-span-2">
                                  <p className="font-medium text-gray-700 mb-2">Additional Details:</p>
                                  <div className="bg-gray-50 rounded-lg p-3">
                                    <pre className="text-xs text-gray-600 whitespace-pre-wrap">
                                      {JSON.stringify(activity.details, null, 2)}
                                    </pre>
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};