
import React from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Navigate } from "react-router-dom";
import SkillsManager from "@/components/skills/SkillsManager";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft } from "lucide-react";
import { Link } from "react-router-dom";
import { toast } from "@/components/ui/use-toast";

const ManageSkills = () => {
  const { user, userRole, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary mb-4"></div>
        <p className="text-gray-500">Loading...</p>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  // Redirect employers away from this page
  if (userRole === "employer") {
    toast({
      title: "Access Denied",
      description: "This page is only available for job seekers.",
      variant: "destructive",
    });
    return <Navigate to="/dashboard" replace />;
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-6">
        <Button variant="ghost" asChild className="p-0 mb-4">
          <Link to="/dashboard" className="flex items-center text-gray-600 hover:text-gray-900">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Dashboard
          </Link>
        </Button>
        <h1 className="text-3xl font-bold">Manage Your Skills</h1>
        <p className="text-gray-600 mt-2">
          Add and manage your professional skills to improve job matching.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>My Skills Profile</CardTitle>
        </CardHeader>
        <CardContent>
          <SkillsManager />
        </CardContent>
      </Card>
    </div>
  );
};

export default ManageSkills;
