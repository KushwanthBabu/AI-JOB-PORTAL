
import React, { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "@/components/ui/use-toast";
import { Upload, Eye, MapPin, Calendar } from "lucide-react";
import QuizTaker from "../quizzes/QuizTaker";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";

interface ApplicationsListProps {
  employer?: boolean;
}

const statusColors: Record<string, string> = {
  pending: "bg-gray-100 text-gray-800",
  quiz_completed: "bg-blue-100 text-blue-800",
  resume_requested: "bg-purple-100 text-purple-800",
  resume_submitted: "bg-indigo-100 text-indigo-800",
  interview: "bg-green-100 text-green-800",
  accepted: "bg-emerald-100 text-emerald-800",
  rejected: "bg-red-100 text-red-800"
};

const statusLabels: Record<string, string> = {
  pending: "Pending",
  quiz_completed: "Quiz Completed",
  resume_requested: "Resume Requested",
  resume_submitted: "Resume Submitted",
  interview: "Interview",
  accepted: "Accepted",
  rejected: "Rejected"
};

const usedStatuses = ['interview', 'accepted', 'rejected'];

const ApplicationsList: React.FC<ApplicationsListProps> = ({ employer = false }) => {
  const { userProfile } = useAuth();
  const [applications, setApplications] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadingId, setUploadingId] = useState<string | null>(null);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [selectedQuizId, setSelectedQuizId] = useState<string | null>(null);
  const [quizDialogOpen, setQuizDialogOpen] = useState(false);
  const [interviewDetails, setInterviewDetails] = useState({
    location: "",
    dateTime: "",
    notes: ""
  });
  const [interviewDialogOpen, setInterviewDialogOpen] = useState(false);
  const [selectedApplicationId, setSelectedApplicationId] = useState<string | null>(null);

  useEffect(() => {
    if (userProfile) {
      fetchApplications();
    }
  }, [userProfile, employer]);

  const fetchApplications = async () => {
    try {
      setLoading(true);
      let query = supabase
        .from("applications")
        .select(`
          *,
          jobs(*),
          quizzes(*),
          profiles:employee_id(first_name, last_name)
        `);

      if (employer) {
        const { data: jobsData, error: jobsError } = await supabase
          .from('jobs')
          .select('id')
          .eq('employer_id', userProfile.id);
        
        if (jobsError) throw jobsError;
        
        if (jobsData && jobsData.length > 0) {
          const jobIds = jobsData.map(job => job.id);
          query = query.in('job_id', jobIds);
        } else {
          setApplications([]);
          setLoading(false);
          return;
        }
      } else {
        query = query
          .eq('employee_id', userProfile.id);
      }

      query = query.order('created_at', { ascending: false });

      const { data, error } = await query;

      if (error) {
        throw error;
      }

      setApplications(data || []);
    } catch (error: any) {
      toast({
        title: "Error fetching applications",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setSelectedFile(e.target.files[0]);
    }
  };

  const handleUploadResume = async (applicationId: string) => {
    if (!selectedFile) {
      toast({
        title: "No file selected",
        description: "Please select a file to upload",
        variant: "destructive",
      });
      return;
    }

    try {
      setUploadingId(applicationId);
      
      const filePath = `${userProfile.id}/${Date.now()}-${selectedFile.name}`;
      const { error: uploadError } = await supabase.storage
        .from('resumes')
        .upload(filePath, selectedFile);
      
      if (uploadError) throw uploadError;
      
      const { error: updateError } = await supabase
        .from('applications')
        .update({
          resume_url: `resumes/${filePath}`,
          status: 'resume_submitted',
          updated_at: new Date().toISOString()
        })
        .eq('id', applicationId);
      
      if (updateError) throw updateError;
      
      fetchApplications();
      setSelectedFile(null);
      
      toast({
        title: "Resume Uploaded",
        description: "Your resume has been uploaded successfully",
      });
    } catch (error: any) {
      toast({
        title: "Error uploading resume",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setUploadingId(null);
    }
  };

  const handleStatusChange = async (applicationId: string, newStatus: string) => {
    try {
      setUpdatingId(applicationId);
      
      if (newStatus === "interview") {
        setSelectedApplicationId(applicationId);
        setInterviewDetails({
          location: "",
          dateTime: "",
          notes: ""
        });
        setInterviewDialogOpen(true);
        setUpdatingId(null);
        return;
      }
      
      const { error } = await supabase
        .from('applications')
        .update({
          status: newStatus,
          updated_at: new Date().toISOString()
        })
        .eq('id', applicationId);
      
      if (error) throw error;
      
      fetchApplications();
      
      toast({
        title: "Status Updated",
        description: `Application status updated to ${statusLabels[newStatus]}`,
      });
    } catch (error: any) {
      toast({
        title: "Error updating status",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setUpdatingId(null);
    }
  };

  const scheduleInterview = async () => {
    if (!selectedApplicationId) return;
    
    if (!interviewDetails.location || !interviewDetails.dateTime) {
      toast({
        title: "Missing Details",
        description: "Please provide both location and date/time for the interview",
        variant: "destructive",
      });
      return;
    }
    
    try {
      setUpdatingId(selectedApplicationId);
      
      const { error } = await supabase
        .from('applications')
        .update({
          status: 'interview',
          updated_at: new Date().toISOString(),
          interview_details: {
            location: interviewDetails.location,
            dateTime: interviewDetails.dateTime,
            notes: interviewDetails.notes
          }
        })
        .eq('id', selectedApplicationId);
      
      if (error) throw error;
      
      setInterviewDialogOpen(false);
      fetchApplications();
      
      toast({
        title: "Interview Scheduled",
        description: "Interview details have been saved and the candidate has been notified",
      });
    } catch (error: any) {
      toast({
        title: "Error scheduling interview",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setUpdatingId(null);
      setSelectedApplicationId(null);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-8">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (applications.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-lg text-gray-500">
          {employer
            ? "You haven't received any applications yet."
            : "You haven't applied to any jobs yet."}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {applications.map((app) => {
        const jobTitle = app.jobs?.title || "Unknown Job";
        const applicantName = app.profiles 
          ? `${app.profiles.first_name || ''} ${app.profiles.last_name || ''}`.trim() 
          : "Unknown Applicant";
        
        return (
          <Card key={app.id}>
            <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2">
              <div>
                <CardTitle>{jobTitle}</CardTitle>
                <p className="text-sm text-gray-500 mt-1">
                  {employer 
                    ? `Applicant: ${applicantName}`
                    : `Applied: ${new Date(app.created_at).toLocaleDateString()}`
                  }
                </p>
              </div>
              <Badge className={statusColors[app.status] || statusColors.pending}>
                {statusLabels[app.status] || "Pending"}
              </Badge>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {app.status === 'interview' && !employer && app.interview_details && (
                  <div className="bg-green-50 p-3 rounded-md space-y-2">
                    <p className="text-sm font-medium">Interview Details</p>
                    <div className="flex items-center text-sm">
                      <MapPin className="h-4 w-4 mr-2 text-green-600" />
                      <span>Location: {app.interview_details.location}</span>
                    </div>
                    <div className="flex items-center text-sm">
                      <Calendar className="h-4 w-4 mr-2 text-green-600" />
                      <span>Date/Time: {app.interview_details.dateTime}</span>
                    </div>
                    {app.interview_details.notes && (
                      <div className="text-sm mt-2">
                        <p className="font-medium">Additional Notes:</p>
                        <p className="text-gray-600">{app.interview_details.notes}</p>
                      </div>
                    )}
                  </div>
                )}
                
                <div className="bg-gray-50 p-3 rounded-md">
                  <p className="text-sm font-medium">Quiz Status</p>
                  {app.quizzes && app.quizzes.length > 0 ? (
                    <div className="mt-1">
                      <div className="flex items-center justify-between">
                        <p className="text-sm">
                          {app.quizzes[0].status === 'completed' 
                            ? (
                              <span className="flex items-center">
                                <span className="text-green-600 font-medium">Completed</span>
                                {app.quizzes[0].score !== null && (
                                  <span className="ml-2 px-2 py-1 bg-green-100 text-green-800 text-xs font-medium rounded-full">
                                    Score: {app.quizzes[0].score}%
                                  </span>
                                )}
                              </span>
                            ) 
                            : (
                              <span className="text-amber-600">
                                {app.quizzes[0].status === 'in_progress' ? 'In Progress' : 'Pending'}
                              </span>
                            )
                          }
                        </p>
                        
                        {app.quizzes[0].status === 'completed' && (
                          <>
                            <Dialog 
                              open={quizDialogOpen && selectedQuizId === app.quizzes[0].id}
                              onOpenChange={(open) => {
                                if (!open) {
                                  setQuizDialogOpen(false);
                                  setSelectedQuizId(null);
                                }
                              }}
                            >
                              <DialogTrigger asChild>
                                <Button 
                                  size="sm" 
                                  variant="outline"
                                  onClick={() => {
                                    setSelectedQuizId(app.quizzes[0].id);
                                    setQuizDialogOpen(true);
                                  }}
                                >
                                  <Eye className="h-4 w-4 mr-2" />
                                  View Quiz Results
                                </Button>
                              </DialogTrigger>
                              <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                                <DialogHeader>
                                  <DialogTitle>
                                    Quiz Results: {jobTitle}
                                  </DialogTitle>
                                </DialogHeader>
                                {selectedQuizId && (
                                  <QuizTaker 
                                    quizId={selectedQuizId} 
                                    viewMode={true} 
                                    isEmployer={employer}
                                  />
                                )}
                              </DialogContent>
                            </Dialog>
                          </>
                        )}
                      </div>
                      
                      {employer && app.quizzes[0].status === 'completed' && app.quizzes[0].score !== null && (
                        <div className="mt-2">
                          <div className="h-2 w-full bg-gray-200 rounded-full overflow-hidden">
                            <div 
                              className="h-full bg-primary" 
                              style={{ width: `${app.quizzes[0].score}%` }}
                            ></div>
                          </div>
                          <p className="text-xs text-gray-500 mt-1">
                            {app.quizzes[0].score >= 80 ? 'Excellent' : 
                             app.quizzes[0].score >= 60 ? 'Good' : 
                             app.quizzes[0].score >= 40 ? 'Average' : 'Needs Improvement'}
                          </p>
                        </div>
                      )}
                    </div>
                  ) : (
                    <p className="text-sm text-gray-500 mt-1">No quiz assigned</p>
                  )}
                </div>
                
                {app.status === 'resume_requested' && !employer && (
                  <div className="bg-gray-50 p-4 rounded-md">
                    <p className="text-sm font-medium mb-2">Upload Resume</p>
                    <div className="flex flex-col sm:flex-row gap-2">
                      <input
                        type="file"
                        onChange={handleFileChange}
                        accept=".pdf,.doc,.docx"
                        className="text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-primary file:text-white hover:file:bg-primary/80"
                      />
                      <Button 
                        onClick={() => handleUploadResume(app.id)}
                        disabled={!selectedFile || uploadingId === app.id}
                        size="sm"
                      >
                        {uploadingId === app.id ? (
                          <span className="flex items-center">
                            <span className="animate-spin mr-2 h-4 w-4 border-t-2 border-b-2 border-white rounded-full"></span>
                            Uploading...
                          </span>
                        ) : (
                          <>
                            <Upload className="h-4 w-4 mr-2" />
                            Upload
                          </>
                        )}
                      </Button>
                    </div>
                  </div>
                )}
                
                {employer && (
                  <div className="flex justify-between items-center pt-2">
                    <div>
                      {app.resume_url && app.status !== 'pending' && app.status !== 'quiz_completed' && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={async () => {
                            const { data, error } = await supabase.storage
                              .from('resumes')
                              .createSignedUrl(app.resume_url.replace('resumes/', ''), 60);
                            
                            if (error) {
                              toast({
                                title: "Error",
                                description: "Could not access resume",
                                variant: "destructive",
                              });
                              return;
                            }
                            
                            window.open(data.signedUrl, '_blank');
                          }}
                        >
                          View Resume
                        </Button>
                      )}
                    </div>
                    
                    <div className="flex items-center gap-2">
                      <Select
                        onValueChange={(value) => handleStatusChange(app.id, value)}
                        defaultValue={app.status}
                        disabled={updatingId === app.id}
                      >
                        <SelectTrigger className="w-[180px]">
                          <SelectValue placeholder="Change status" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="pending">Pending</SelectItem>
                          <SelectItem value="quiz_completed">Quiz Completed</SelectItem>
                          <SelectItem value="resume_requested">Request Resume</SelectItem>
                          <SelectItem value="resume_submitted">Resume Submitted</SelectItem>
                          <SelectItem value="interview">Schedule Interview</SelectItem>
                          <SelectItem value="accepted">Accept</SelectItem>
                          <SelectItem value="rejected">Reject</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        );
      })}

      <Dialog open={interviewDialogOpen} onOpenChange={setInterviewDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Schedule Interview</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="location">Interview Location</Label>
              <Input
                id="location"
                placeholder="Office address or video call link"
                value={interviewDetails.location}
                onChange={(e) => setInterviewDetails({...interviewDetails, location: e.target.value})}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="dateTime">Date & Time</Label>
              <Input
                id="dateTime"
                placeholder="e.g., June 15, 2023 at 10:00 AM EST"
                value={interviewDetails.dateTime}
                onChange={(e) => setInterviewDetails({...interviewDetails, dateTime: e.target.value})}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="notes">Additional Notes (Optional)</Label>
              <Textarea
                id="notes"
                placeholder="Any preparation instructions or details"
                value={interviewDetails.notes}
                onChange={(e) => setInterviewDetails({...interviewDetails, notes: e.target.value})}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setInterviewDialogOpen(false)}>Cancel</Button>
            <Button onClick={scheduleInterview} disabled={!interviewDetails.location || !interviewDetails.dateTime}>
              Schedule Interview
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ApplicationsList;
