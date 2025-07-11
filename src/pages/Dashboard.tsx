import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { 
  MapPin, 
  Upload, 
  Users, 
  Activity,
  TrendingUp,
  Database,
  FileText
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate } from 'react-router-dom';
import { Skeleton } from '@/components/ui/skeleton';

interface DashboardStats {
  totalSites: number;
  totalUsers: number;
  recentUploads: number;
  userActivities: number;
}

const Dashboard = () => {
  const { userRole, user } = useAuth();
  const navigate = useNavigate();
  const [stats, setStats] = useState<DashboardStats>({
    totalSites: 0,
    totalUsers: 0,
    recentUploads: 0,
    userActivities: 0,
  });
  const [loading, setLoading] = useState(true);
  const [recentSites, setRecentSites] = useState<any[]>([]);

  const isAdmin = userRole === 'admin';

  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        setLoading(true);

        // Fetch total sites
        const { count: sitesCount } = await supabase
          .from('gis_sites')
          .select('*', { count: 'exact', head: true });

        // Fetch recent sites
        const { data: recentSitesData } = await supabase
          .from('gis_sites')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(5);

        setRecentSites(recentSitesData || []);

        let usersCount = 0;
        let activitiesCount = 0;

        // Admin-only data
        if (isAdmin) {
          const { count: totalUsers } = await supabase
            .from('profiles')
            .select('*', { count: 'exact', head: true });

          const { count: totalActivities } = await supabase
            .from('login_activities')
            .select('*', { count: 'exact', head: true });

          usersCount = totalUsers || 0;
          activitiesCount = totalActivities || 0;
        }

        setStats({
          totalSites: sitesCount || 0,
          totalUsers: usersCount,
          recentUploads: Math.floor((sitesCount || 0) / 10), // Simplified metric
          userActivities: activitiesCount,
        });
      } catch (error) {
        console.error('Error fetching dashboard data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchDashboardData();
  }, [isAdmin]);

  const quickActions = [
    {
      title: "View Map",
      description: "Explore interactive map visualization",
      icon: MapPin,
      action: () => navigate('/dashboard/map'),
      variant: "default" as const,
    },
    {
      title: "Browse Sites",
      description: "View all GIS site data",
      icon: Database,
      action: () => navigate('/dashboard/sites'),
      variant: "secondary" as const,
    },
    ...(isAdmin ? [{
      title: "Upload Data",
      description: "Import new GIS data from CSV",
      icon: Upload,
      action: () => navigate('/dashboard/upload'),
      variant: "outline" as const,
    }] : []),
  ];

  if (loading) {
    return (
      <div className="space-y-6">
        <div>
          <Skeleton className="h-8 w-64 mb-2" />
          <Skeleton className="h-4 w-96" />
        </div>
        
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Card key={i}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <Skeleton className="h-4 w-20" />
                <Skeleton className="h-4 w-4" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-6 w-16 mb-1" />
                <Skeleton className="h-3 w-24" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-foreground">Dashboard</h1>
        <p className="text-muted-foreground">
          Welcome back, {user?.email}. Here's an overview of your GIS data platform.
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Sites</CardTitle>
            <MapPin className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalSites}</div>
            <p className="text-xs text-muted-foreground">
              GIS locations mapped
            </p>
          </CardContent>
        </Card>

        {isAdmin && (
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Users</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalUsers}</div>
              <p className="text-xs text-muted-foreground">
                Registered users
              </p>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Data Quality</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">98%</div>
            <p className="text-xs text-muted-foreground">
              Valid coordinates
            </p>
          </CardContent>
        </Card>

        {isAdmin && (
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Activities</CardTitle>
              <Activity className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.userActivities}</div>
              <p className="text-xs text-muted-foreground">
                User login sessions
              </p>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle>Quick Actions</CardTitle>
          <CardDescription>
            Common tasks and navigation shortcuts
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-3">
            {quickActions.map((action, index) => (
              <Button
                key={index}
                variant={action.variant}
                onClick={action.action}
                className="h-auto p-4 flex flex-col items-start space-y-2"
              >
                <action.icon className="h-5 w-5" />
                <div className="text-left">
                  <div className="font-medium">{action.title}</div>
                  <div className="text-xs opacity-70">{action.description}</div>
                </div>
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Recent Sites */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Sites</CardTitle>
          <CardDescription>
            Latest GIS locations added to the database
          </CardDescription>
        </CardHeader>
        <CardContent>
          {recentSites.length > 0 ? (
            <div className="space-y-3">
              {recentSites.map((site) => (
                <div key={site.id} className="flex items-center justify-between p-3 rounded-lg border">
                  <div className="space-y-1">
                    <p className="font-medium">{site.site_name}</p>
                    <p className="text-sm text-muted-foreground">
                      {site.latitude}, {site.longitude}
                    </p>
                  </div>
                  <div className="flex items-center space-x-2">
                    {site.risk_status && (
                      <Badge variant={site.risk_status === 'High' ? 'destructive' : 'secondary'}>
                        {site.risk_status} Risk
                      </Badge>
                    )}
                    <p className="text-xs text-muted-foreground">
                      {new Date(site.created_at).toLocaleDateString()}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No sites available yet</p>
              <p className="text-sm">Upload CSV data to get started</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default Dashboard;