import React, { useState, useEffect } from 'react';
import { 
  User, 
  Mail, 
  Building, 
  Calendar, 
  Activity, 
  FileText, 
  Tag, 
  Download, 
  TrendingUp, 
  Clock, 
  Edit2, 
  Save, 
  X, 
  Settings, 
  BarChart3, 
  PieChart, 
  Zap,
  Star,
  Shield,
  Crown,
  Award,
  Target,
  Sparkles,
  ChevronRight,
  Server,
  FileType,
  ExternalLink
} from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { AuthService } from '../services/authService';
import { ActivityService } from '../services/activityService';
import { TemplateService } from '../services/templateService';
import { GenerationService } from '../services/generationService';
import { CloudConvertService } from '../services/cloudConvertService';
import { OnlyOfficeService } from '../services/onlyOfficeService';

interface UserProfileProps {
  onClose: () => void;
}

export const UserProfile: React.FC<UserProfileProps> = ({ onClose }) => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<'overview' | 'activity' | 'settings'>('overview');
  const [profile, setProfile] = useState<any>(null);
  const [stats, setStats] = useState<any>(null);
  const [recentActivity, setRecentActivity] = useState<any[]>([]);
  const [recentGenerations, setRecentGenerations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [editData, setEditData] = useState({
    full_name: '',
    company: '',
    role: ''
  });
  const [onlyOfficeUrl, setOnlyOfficeUrl] = useState('');
  const [pdfConversionMethod, setPdfConversionMethod] = useState<'cloudconvert' | 'onlyoffice'>('cloudconvert');
  const [isSavingSettings, setIsSavingSettings] = useState(false);
  const [settingsMessage, setSettingsMessage] = useState<{type: 'success' | 'error', text: string} | null>(null);

  useEffect(() => {
    loadProfileData();
  }, []);

  const loadProfileData = async () => {
    try {
      setLoading(true);
      
      // Load user profile
      const profileData = await AuthService.getProfile();
      setProfile(profileData);
      setEditData({
        full_name: profileData.full_name || '',
        company: profileData.company || '',
        role: profileData.role || ''
      });

      // Load OnlyOffice URL and PDF conversion method from preferences
      const preferences = profileData.preferences || {};
      setOnlyOfficeUrl(preferences.onlyoffice_url || '');
      setPdfConversionMethod(preferences.pdf_conversion_method || 'cloudconvert');

      // Load statistics
      const [templateStats, activityStats, generationStats] = await Promise.all([
        TemplateService.getTemplateStats(),
        ActivityService.getActivityStats(30),
        GenerationService.getGenerationStats(30)
      ]);

      setStats({
        templates: templateStats,
        activity: activityStats,
        generations: generationStats
      });

      // Load recent activity
      const activity = await ActivityService.getRecentActivity(20);
      setRecentActivity(activity);

      // Load recent generations
      const generations = await GenerationService.getGenerations({ limit: 10 });
      setRecentGenerations(generations);

    } catch (error) {
      console.error('Failed to load profile data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveProfile = async () => {
    try {
      await AuthService.updateProfile(editData);
      setProfile(prev => ({ ...prev, ...editData }));
      setIsEditing(false);
    } catch (error) {
      console.error('Failed to update profile:', error);
    }
  };

  const handleSaveSettings = async () => {
    try {
      setIsSavingSettings(true);
      setSettingsMessage(null);
      
      // Update preferences with OnlyOffice URL and PDF conversion method
      const updatedPreferences = {
        ...(profile?.preferences || {}),
        onlyoffice_url: onlyOfficeUrl.trim(),
        pdf_conversion_method: pdfConversionMethod
      };
      
      await AuthService.updateProfile({
        preferences: updatedPreferences
      });
      
      // Update OnlyOffice service with new URL
      OnlyOfficeService.setServerUrl(onlyOfficeUrl.trim());
      
      setSettingsMessage({
        type: 'success',
        text: 'Settings saved successfully'
      });
      
      // Refresh profile data
      await loadProfileData();
    } catch (error) {
      console.error('Failed to save settings:', error);
      setSettingsMessage({
        type: 'error',
        text: 'Failed to save settings'
      });
    } finally {
      setIsSavingSettings(false);
    }
  };

  const testOnlyOfficeConnection = async () => {
    try {
      setIsSavingSettings(true);
      setSettingsMessage(null);
      
      // Test connection to OnlyOffice server
      const isAvailable = await OnlyOfficeService.checkServerAvailability(onlyOfficeUrl.trim());
      
      if (isAvailable) {
        setSettingsMessage({
          type: 'success',
          text: 'My Editor server is available and responding'
        });
      } else {
        setSettingsMessage({
          type: 'error',
          text: 'My Editor server is not responding. Please check the URL and server status.'
        });
      }
    } catch (error) {
      console.error('Failed to test My Editor connection:', error);
      setSettingsMessage({
        type: 'error',
        text: 'Failed to connect to My Editor server'
      });
    } finally {
      setIsSavingSettings(false);
    }
  };

  const formatDate = (date: string | Date) => {
    if (!date) return 'N/A';
    
    const d = new Date(date);
    if (isNaN(d.getTime())) return 'N/A';
    
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
      case 'data_imported': return 'Imported data';
      case 'tag_created': return 'Created tag';
      case 'tag_updated': return 'Updated tag';
      case 'category_created': return 'Created category';
      case 'login': return 'Signed in';
      case 'export_data': return 'Exported data';
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

  const getSubscriptionBadge = (tier: string) => {
    switch (tier) {
      case 'pro':
        return (
          <div className="flex items-center space-x-1 px-2 py-1 bg-gradient-to-r from-blue-100 to-indigo-100 border border-blue-300 rounded-full">
            <Crown className="w-3 h-3 text-blue-600" />
            <span className="text-xs font-medium text-blue-700">Pro</span>
          </div>
        );
      case 'enterprise':
        return (
          <div className="flex items-center space-x-1 px-2 py-1 bg-gradient-to-r from-purple-100 to-pink-100 border border-purple-300 rounded-full">
            <Award className="w-3 h-3 text-purple-600" />
            <span className="text-xs font-medium text-purple-700">Enterprise</span>
          </div>
        );
      default:
        return (
          <div className="flex items-center space-x-1 px-2 py-1 bg-gradient-to-r from-gray-100 to-slate-100 border border-gray-300 rounded-full">
            <Shield className="w-3 h-3 text-gray-600" />
            <span className="text-xs font-medium text-gray-700">Free</span>
          </div>
        );
    }
  };

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
        <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden">
          <div className="flex items-center justify-center py-20">
            <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-2xl shadow-2xl max-w-6xl w-full max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="border-b border-gray-200 p-6 bg-gradient-to-r from-blue-50 to-indigo-50">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className="w-16 h-16 bg-gradient-to-r from-blue-500 to-indigo-600 rounded-2xl flex items-center justify-center">
                <User className="w-8 h-8 text-white" />
              </div>
              <div>
                <h2 className="text-2xl font-bold text-gray-900">
                  {profile?.full_name || user?.email?.split('@')[0] || 'User Profile'}
                </h2>
                <div className="flex items-center space-x-3 mt-1">
                  <p className="text-gray-600">{profile?.email}</p>
                  {getSubscriptionBadge(profile?.subscription_tier)}
                </div>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-xl transition-all duration-200"
            >
              <X className="w-6 h-6" />
            </button>
          </div>

          {/* Tab Navigation */}
          <div className="flex space-x-1 mt-6 bg-white/60 backdrop-blur-sm rounded-xl p-1">
            <button
              onClick={() => setActiveTab('overview')}
              className={`flex-1 flex items-center justify-center space-x-2 px-4 py-2 rounded-lg transition-all duration-200 ${
                activeTab === 'overview'
                  ? 'bg-white text-blue-600 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <BarChart3 className="w-4 h-4" />
              <span className="font-medium">Overview</span>
            </button>
            <button
              onClick={() => setActiveTab('activity')}
              className={`flex-1 flex items-center justify-center space-x-2 px-4 py-2 rounded-lg transition-all duration-200 ${
                activeTab === 'activity'
                  ? 'bg-white text-blue-600 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <Activity className="w-4 h-4" />
              <span className="font-medium">Activity</span>
            </button>
            <button
              onClick={() => setActiveTab('settings')}
              className={`flex-1 flex items-center justify-center space-x-2 px-4 py-2 rounded-lg transition-all duration-200 ${
                activeTab === 'settings'
                  ? 'bg-white text-blue-600 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <Settings className="w-4 h-4" />
              <span className="font-medium">Settings</span>
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[calc(90vh-200px)]">
          {activeTab === 'overview' && (
            <div className="space-y-6">
              {/* Quick Stats */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <StatCard
                  title="Templates Created"
                  value={stats?.templates?.totalTemplates || 0}
                  icon={<FileText className="w-5 h-5" />}
                  color="blue"
                  trend={`${stats?.templates?.recentTemplates || 0} this week`}
                />
                <StatCard
                  title="Documents Generated"
                  value={stats?.generations?.totalDocuments || 0}
                  icon={<Download className="w-5 h-5" />}
                  color="green"
                  trend={`${stats?.generations?.totalGenerations || 0} generations`}
                />
                <StatCard
                  title="Total Tags"
                  value={stats?.templates?.totalTags || 0}
                  icon={<Tag className="w-5 h-5" />}
                  color="purple"
                  trend="Across all templates"
                />
                <StatCard
                  title="Activities"
                  value={stats?.activity?.totalActivities || 0}
                  icon={<Activity className="w-5 h-5" />}
                  color="orange"
                  trend="Last 30 days"
                />
              </div>

              {/* Profile Summary & Recent Activity */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Profile Summary */}
                <div className="bg-gradient-to-br from-white to-blue-50 rounded-2xl border border-gray-200 p-6">
                  <h3 className="text-lg font-bold text-gray-900 mb-4">Profile Information</h3>
                  <div className="space-y-4">
                    <div className="flex items-center space-x-3">
                      <Mail className="w-5 h-5 text-gray-400" />
                      <div>
                        <p className="text-sm text-gray-500">Email</p>
                        <p className="font-medium text-gray-900">{profile?.email}</p>
                      </div>
                    </div>
                    {profile?.company && (
                      <div className="flex items-center space-x-3">
                        <Building className="w-5 h-5 text-gray-400" />
                        <div>
                          <p className="text-sm text-gray-500">Company</p>
                          <p className="font-medium text-gray-900">{profile.company}</p>
                        </div>
                      </div>
                    )}
                    {profile?.role && (
                      <div className="flex items-center space-x-3">
                        <Target className="w-5 h-5 text-gray-400" />
                        <div>
                          <p className="text-sm text-gray-500">Role</p>
                          <p className="font-medium text-gray-900">{profile.role}</p>
                        </div>
                      </div>
                    )}
                    <div className="flex items-center space-x-3">
                      <Calendar className="w-5 h-5 text-gray-400" />
                      <div>
                        <p className="text-sm text-gray-500">Member Since</p>
                        <p className="font-medium text-gray-900">{formatDate(profile?.created_at)}</p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Recent Generations */}
                <div className="bg-gradient-to-br from-white to-green-50 rounded-2xl border border-gray-200 p-6">
                  <h3 className="text-lg font-bold text-gray-900 mb-4">Recent Generations</h3>
                  {recentGenerations.length === 0 ? (
                    <div className="text-center py-8">
                      <Download className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                      <p className="text-gray-500 text-sm">No documents generated yet</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {recentGenerations.slice(0, 5).map((generation) => (
                        <div key={generation.id} className="flex items-center justify-between p-3 bg-white/60 rounded-xl">
                          <div className="flex items-center space-x-3">
                            <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                              generation.status === 'completed' ? 'bg-green-100' :
                              generation.status === 'failed' ? 'bg-red-100' :
                              generation.status === 'processing' ? 'bg-blue-100' : 'bg-gray-100'
                            }`}>
                              <Download className={`w-4 h-4 ${
                                generation.status === 'completed' ? 'text-green-600' :
                                generation.status === 'failed' ? 'text-red-600' :
                                generation.status === 'processing' ? 'text-blue-600' : 'text-gray-600'
                              }`} />
                            </div>
                            <div>
                              <p className="font-medium text-gray-900 text-sm">
                                {generation.template?.name || 'Unknown Template'}
                              </p>
                              <p className="text-xs text-gray-500">
                                {generation.documents_count} document{generation.documents_count !== 1 ? 's' : ''}
                              </p>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className={`text-xs font-medium ${
                              generation.status === 'completed' ? 'text-green-600' :
                              generation.status === 'failed' ? 'text-red-600' :
                              generation.status === 'processing' ? 'text-blue-600' : 'text-gray-600'
                            }`}>
                              {generation.status}
                            </p>
                            <p className="text-xs text-gray-500">{formatDate(generation.created_at)}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Activity Chart */}
              <div className="bg-gradient-to-br from-white to-purple-50 rounded-2xl border border-gray-200 p-6">
                <h3 className="text-lg font-bold text-gray-900 mb-4">Activity Overview</h3>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  {Object.entries(stats?.activity?.byType || {}).map(([type, count]) => (
                    <div key={type} className="text-center p-4 bg-white/60 rounded-xl">
                      <p className="text-2xl font-bold text-gray-900">{count as number}</p>
                      <p className="text-sm text-gray-600 capitalize">{type.replace('_', ' ')}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'activity' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-bold text-gray-900">Recent Activity</h3>
                <div className="flex items-center space-x-2 text-sm text-gray-500">
                  <Clock className="w-4 h-4" />
                  <span>Last 30 days</span>
                </div>
              </div>

              {recentActivity.length === 0 ? (
                <div className="text-center py-12">
                  <Activity className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">No activity yet</h3>
                  <p className="text-gray-500">Start using the platform to see your activity here.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {recentActivity.map((activity) => (
                    <div key={activity.id} className="flex items-center space-x-4 p-4 bg-white rounded-xl border border-gray-200 hover:shadow-md transition-all duration-200">
                      <div className="w-10 h-10 bg-gradient-to-r from-blue-100 to-indigo-100 rounded-xl flex items-center justify-center flex-shrink-0">
                        {getActivityIcon(activity.activity_type)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <p className="font-medium text-gray-900 text-sm">
                            {formatActivityType(activity.activity_type)}
                          </p>
                          <p className="text-xs text-gray-500">{formatDate(activity.created_at)}</p>
                        </div>
                        {activity.details?.template_name && (
                          <p className="text-xs text-gray-600 mt-1 truncate">
                            {activity.details.template_name}
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === 'settings' && (
            <div className="space-y-6">
              <div className="bg-white rounded-2xl border border-gray-200 p-6">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-lg font-bold text-gray-900">Profile Settings</h3>
                  {!isEditing ? (
                    <button
                      onClick={() => setIsEditing(true)}
                      className="flex items-center space-x-2 px-4 py-2 text-blue-600 hover:bg-blue-50 rounded-xl transition-all duration-200"
                    >
                      <Edit2 className="w-4 h-4" />
                      <span>Edit</span>
                    </button>
                  ) : (
                    <div className="flex space-x-2">
                      <button
                        onClick={handleSaveProfile}
                        className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-all duration-200"
                      >
                        <Save className="w-4 h-4" />
                        <span>Save</span>
                      </button>
                      <button
                        onClick={() => {
                          setIsEditing(false);
                          setEditData({
                            full_name: profile?.full_name || '',
                            company: profile?.company || '',
                            role: profile?.role || ''
                          });
                        }}
                        className="flex items-center space-x-2 px-4 py-2 text-gray-600 hover:bg-gray-50 rounded-xl transition-all duration-200"
                      >
                        <X className="w-4 h-4" />
                        <span>Cancel</span>
                      </button>
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Full Name
                    </label>
                    {isEditing ? (
                      <input
                        type="text"
                        value={editData.full_name}
                        onChange={(e) => setEditData({ ...editData, full_name: e.target.value })}
                        className="w-full px-4 py-3 border border-gray-300 rounded-xl shadow-sm focus:ring-blue-500 focus:border-blue-500 transition-all duration-200"
                        placeholder="Enter your full name"
                      />
                    ) : (
                      <p className="px-4 py-3 bg-gray-50 rounded-xl text-gray-900">
                        {profile?.full_name || 'Not set'}
                      </p>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Email Address
                    </label>
                    <p className="px-4 py-3 bg-gray-50 rounded-xl text-gray-900">
                      {profile?.email}
                    </p>
                    <p className="text-xs text-gray-500 mt-1">Email cannot be changed</p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Company
                    </label>
                    {isEditing ? (
                      <input
                        type="text"
                        value={editData.company}
                        onChange={(e) => setEditData({ ...editData, company: e.target.value })}
                        className="w-full px-4 py-3 border border-gray-300 rounded-xl shadow-sm focus:ring-blue-500 focus:border-blue-500 transition-all duration-200"
                        placeholder="Enter your company name"
                      />
                    ) : (
                      <p className="px-4 py-3 bg-gray-50 rounded-xl text-gray-900">
                        {profile?.company || 'Not set'}
                      </p>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Role
                    </label>
                    {isEditing ? (
                      <input
                        type="text"
                        value={editData.role}
                        onChange={(e) => setEditData({ ...editData, role: e.target.value })}
                        className="w-full px-4 py-3 border border-gray-300 rounded-xl shadow-sm focus:ring-blue-500 focus:border-blue-500 transition-all duration-200"
                        placeholder="Enter your role"
                      />
                    ) : (
                      <p className="px-4 py-3 bg-gray-50 rounded-xl text-gray-900">
                        {profile?.role || 'Not set'}
                      </p>
                    )}
                  </div>
                </div>
              </div>

              {/* OnlyOffice Settings */}
              <div className="bg-gradient-to-br from-white to-blue-50 rounded-2xl border border-gray-200 p-6">
                <div className="flex items-center space-x-3 mb-6">
                  <div className="w-10 h-10 bg-gradient-to-r from-blue-500 to-indigo-600 rounded-xl flex items-center justify-center">
                    <Server className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-gray-900">My Editor Settings</h3>
                    <p className="text-sm text-gray-600">Configure My Editor integration for document editing</p>
                  </div>
                </div>

                {settingsMessage && (
                  <div className={`p-3 mb-4 rounded-xl border ${
                    settingsMessage.type === 'success' 
                      ? 'bg-green-50 border-green-200 text-green-800' 
                      : 'bg-red-50 border-red-200 text-red-800'
                  }`}>
                    <p className="text-sm">{settingsMessage.text}</p>
                  </div>
                )}

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      My Editor Server URL
                    </label>
                    <div className="flex space-x-2">
                      <input
                        type="text"
                        value={onlyOfficeUrl}
                        onChange={(e) => setOnlyOfficeUrl(e.target.value)}
                        className="flex-1 px-4 py-3 border border-gray-300 rounded-xl shadow-sm focus:ring-blue-500 focus:border-blue-500 transition-all duration-200"
                        placeholder="http://your-editor-server:8082"
                      />
                      <button
                        onClick={testOnlyOfficeConnection}
                        disabled={isSavingSettings}
                        className="px-4 py-2 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-all duration-200 disabled:opacity-50"
                      >
                        Test
                      </button>
                    </div>
                    <p className="text-xs text-gray-500 mt-1">
                      Enter the URL of your My Editor Document Server
                    </p>
                  </div>

                  <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
                    <div className="flex items-center space-x-2 mb-2">
                      <ExternalLink className="w-4 h-4 text-blue-600" />
                      <h4 className="text-sm font-semibold text-blue-900">My Editor Integration</h4>
                    </div>
                    <p className="text-xs text-blue-800">
                      My Editor provides a full-featured document editor for creating and editing templates. 
                      Make sure your My Editor server is accessible from your browser.
                    </p>
                  </div>
                </div>
              </div>

              {/* PDF Conversion Settings */}
              <div className="bg-gradient-to-br from-white to-red-50 rounded-2xl border border-gray-200 p-6">
                <div className="flex items-center space-x-3 mb-6">
                  <div className="w-10 h-10 bg-gradient-to-r from-red-500 to-orange-600 rounded-xl flex items-center justify-center">
                    <FileType className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-gray-900">PDF Conversion Method</h3>
                    <p className="text-sm text-gray-600">Choose how to convert DOCX documents to PDF</p>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="flex items-center space-x-4">
                    <div className="flex items-center">
                      <input
                        type="radio"
                        id="cloudconvert"
                        name="pdfConversionMethod"
                        value="cloudconvert"
                        checked={pdfConversionMethod === 'cloudconvert'}
                        onChange={() => setPdfConversionMethod('cloudconvert')}
                        className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300"
                      />
                      <label htmlFor="cloudconvert" className="ml-2 block text-sm text-gray-900">
                        OnlineConverter
                      </label>
                    </div>
                    <div className="flex items-center">
                      <input
                        type="radio"
                        id="onlyoffice"
                        name="pdfConversionMethod"
                        value="onlyoffice"
                        checked={pdfConversionMethod === 'onlyoffice'}
                        onChange={() => setPdfConversionMethod('onlyoffice')}
                        className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300"
                      />
                      <label htmlFor="onlyoffice" className="ml-2 block text-sm text-gray-900">
                        My Editor
                      </label>
                    </div>
                  </div>

                  <div className="bg-orange-50 border border-orange-200 rounded-xl p-4">
                    <div className="flex items-center space-x-2 mb-2">
                      <FileType className="w-4 h-4 text-orange-600" />
                      <h4 className="text-sm font-semibold text-orange-900">PDF Conversion Options</h4>
                    </div>
                    <p className="text-xs text-orange-800">
                      <strong>OnlineConverter:</strong> Uses the OnlineConverter API (requires API key in settings).<br />
                      <strong>My Editor:</strong> Uses your My Editor server for conversion (requires server configuration).
                    </p>
                  </div>
                </div>
              </div>

              {/* Save Settings Button */}
              <div className="flex justify-end">
                <button
                  onClick={handleSaveSettings}
                  disabled={isSavingSettings}
                  className="px-6 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl hover:from-blue-700 hover:to-indigo-700 transition-all duration-200 disabled:opacity-50 flex items-center"
                >
                  {isSavingSettings ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Save className="w-4 h-4 mr-2" />
                      Save Settings
                    </>
                  )}
                </button>
              </div>

              {/* Subscription Info */}
              <div className="bg-gradient-to-br from-white to-indigo-50 rounded-2xl border border-gray-200 p-6">
                <h3 className="text-lg font-bold text-gray-900 mb-4">Subscription</h3>
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    {getSubscriptionBadge(profile?.subscription_tier)}
                    <div>
                      <p className="font-medium text-gray-900 capitalize">
                        {profile?.subscription_tier || 'Free'} Plan
                      </p>
                      <p className="text-sm text-gray-600">
                        {profile?.subscription_tier === 'free' && 'Basic features with limited usage'}
                        {profile?.subscription_tier === 'pro' && 'Advanced features with higher limits'}
                        {profile?.subscription_tier === 'enterprise' && 'Full access with unlimited usage'}
                      </p>
                    </div>
                  </div>
                  {profile?.subscription_tier === 'free' && (
                    <button className="px-4 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl hover:from-blue-700 hover:to-indigo-700 transition-all duration-200">
                      Upgrade
                    </button>
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

interface StatCardProps {
  title: string;
  value: number;
  icon: React.ReactNode;
  color: 'blue' | 'green' | 'purple' | 'orange';
  trend: string;
}

const StatCard: React.FC<StatCardProps> = ({ title, value, icon, color, trend }) => {
  const colorClasses = {
    blue: 'from-blue-500 to-blue-600',
    green: 'from-green-500 to-green-600',
    purple: 'from-purple-500 to-purple-600',
    orange: 'from-orange-500 to-orange-600'
  };

  return (
    <div className="bg-white rounded-2xl border border-gray-200 p-6 hover:shadow-lg transition-all duration-300">
      <div className="flex items-center justify-between mb-4">
        <div className={`w-10 h-10 bg-gradient-to-r ${colorClasses[color]} rounded-xl flex items-center justify-center text-white`}>
          {icon}
        </div>
        <TrendingUp className="w-4 h-4 text-green-500" />
      </div>
      <div>
        <h3 className="text-sm font-medium text-gray-600 mb-1">{title}</h3>
        <div className="text-2xl font-bold text-gray-900 mb-1">{value.toLocaleString()}</div>
        <p className="text-xs text-gray-500">{trend}</p>
      </div>
    </div>
  );
};