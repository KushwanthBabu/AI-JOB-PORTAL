
import React, { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Link, useLocation } from "react-router-dom";
import { ArrowRight, Briefcase, Brain, Award } from "lucide-react";
import JobsList from "@/components/jobs/JobsList";
import ApplicationsList from "@/components/applications/ApplicationsList";
import QuizList from "@/components/quizzes/QuizList";
import { supabase } from "@/integrations/supabase/client";

const EmployeeDashboard: React.FC = () => {
  const { userProfile } = useAuth();
  const [jobs, setJobs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const location = useLocation();
  const searchParams = new URLSearchParams(location.search);
  const defaultTab = searchParams.get('tab') || 'applications';

  useEffect(() => {
    fetchJobs();
  }, []);

  const fetchJobs = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("jobs")
        .select("*")
        .eq("is_active", true) // Only get active jobs
        .order("created_at", { ascending: false });

      if (error) {
        throw error;
      }

      setJobs(data || []);
    } catch (error) {
      console.error("Error fetching jobs:", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col space-y-6">
      <div className="flex flex-col space-y-2">
        <h1 className="text-3xl font-bold tracking-tight">Welcome, {userProfile?.first_name}!</h1>
        <p className="text-muted-foreground">
          Manage your job applications and skill assessments all in one place.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center">
              <Briefcase className="mr-2 h-5 w-5" />
              Browse Jobs
            </CardTitle>
            <CardDescription>Find your next opportunity</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm">
              Explore job postings that match your skills and experience.
            </p>
          </CardContent>
          <CardFooter>
            <Button asChild variant="secondary" className="w-full justify-between">
              <Link to="/dashboard?tab=jobs">
                Browse Jobs <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          </CardFooter>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center">
              <Brain className="mr-2 h-5 w-5" />
              Generate Quiz
            </CardTitle>
            <CardDescription>Create practice assessments</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm">
              Generate skill-based quizzes to practice for job assessments.
            </p>
          </CardContent>
          <CardFooter>
            <Button asChild variant="secondary" className="w-full justify-between">
              <Link to="/generate-quiz">
                Generate Quiz <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          </CardFooter>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center">
              <Award className="mr-2 h-5 w-5" />
              Manage Skills
            </CardTitle>
            <CardDescription>Update your skills profile</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm">
              Add, update, or remove skills from your professional profile.
            </p>
          </CardContent>
          <CardFooter>
            <Button asChild variant="secondary" className="w-full justify-between">
              <Link to="/manage-skills">
                Manage Skills <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          </CardFooter>
        </Card>
      </div>

      <Tabs defaultValue={defaultTab} className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="applications">My Applications</TabsTrigger>
          <TabsTrigger value="jobs">Available Jobs</TabsTrigger>
          <TabsTrigger value="quizzes">Practice Quizzes</TabsTrigger>
        </TabsList>
        <TabsContent value="applications">
          <Card>
            <CardHeader>
              <CardTitle>Applications</CardTitle>
              <CardDescription>Track all your job applications</CardDescription>
            </CardHeader>
            <CardContent>
              <ApplicationsList />
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="jobs">
          <Card>
            <CardHeader>
              <CardTitle>Available Jobs</CardTitle>
              <CardDescription>Browse and apply for jobs</CardDescription>
            </CardHeader>
            <CardContent>
              <JobsList 
                jobs={jobs} 
                loading={loading} 
                isEmployee={true} 
                emptyMessage="No jobs available at the moment." 
              />
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="quizzes">
          <Card>
            <CardHeader>
              <CardTitle>Practice Quizzes</CardTitle>
              <CardDescription>Generate and take practice quizzes to prepare for job assessments</CardDescription>
            </CardHeader>
            <CardContent>
              <QuizList showPracticeQuizzes={true} />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default EmployeeDashboard;
