import React, { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "@/components/ui/use-toast";
import { Loader2, RefreshCw, Eye, ArrowRight, SkipForward, Check } from "lucide-react";
import ProficiencySelector from "./ProficiencySelector";
import QuizQuestionComponent from "./QuizQuestion";
import QuizDetails from "./QuizDetails";
import { Progress } from "@/components/ui/progress";

export interface QuizQuestion {
  id: string;
  quiz_id: string;
  question: string;
  options: string[];
  correct_answer: string;
  skill_id: string;
  skills?: {
    name: string;
    id: string;
  } | null;
}

export interface Quiz {
  id: string;
  status: string;
  created_at: string;
  completed_at: string | null;
  score: number | null;
  skill_scores?: Record<string, number> | null;
  application_id: string | null;
  quiz_questions_count?: number;
  applications?: {
    jobs?: {
      title?: string;
    } | null;
  } | null;
}

const QuizLoading = ({ isRefreshing = false }: { isRefreshing?: boolean }) => {
  return (
    <div className="flex flex-col items-center justify-center py-8">
      <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary mb-3"></div>
      <p className="text-gray-500">
        {isRefreshing ? "Refreshing questions..." : "Loading quiz questions..."}
      </p>
      <p className="text-sm text-gray-400 mt-2">
        This may take a moment. The system is checking for your questions.
      </p>
    </div>
  );
};

const QuizEmpty = ({ 
  retryCount, 
  maxRetries, 
  onRefresh,
  isRefreshing = false
}: { 
  retryCount: number; 
  maxRetries: number; 
  onRefresh: () => void;
  isRefreshing?: boolean;
}) => {
  return (
    <div className="text-center py-8 space-y-4">
      <p className="text-lg text-gray-500">
        No questions found for this quiz. The system is still generating your quiz questions.
      </p>
      <div className="flex flex-col items-center justify-center space-y-2">
        <p className="text-sm text-gray-400">
          {retryCount < maxRetries 
            ? `We've tried ${retryCount} times. Auto-retrying in 5 seconds...` 
            : "We've tried several times but couldn't find your questions."}
        </p>
        <p className="text-sm text-gray-400">
          Quiz generation can take up to 1-2 minutes to complete.
        </p>
      </div>
      <Button 
        onClick={onRefresh} 
        className="mt-4"
        disabled={isRefreshing}
      >
        {isRefreshing ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Refreshing...
          </>
        ) : (
          <>
            <RefreshCw className="mr-2 h-4 w-4" />
            Refresh Manually
          </>
        )}
      </Button>
    </div>
  );
};

export const QuizTaker = ({ 
  quizId, 
  applicationId, 
  onComplete = () => {},
  viewMode = false,
  isEmployer = false
}: { 
  quizId: string; 
  applicationId?: string | null; 
  onComplete?: () => void;
  viewMode?: boolean;
  isEmployer?: boolean;
}) => {
  const [loading, setLoading] = useState(true);
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [retryCount, setRetryCount] = useState(0);
  const [retryInProgress, setRetryInProgress] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [skippedQuestions, setSkippedQuestions] = useState<Set<string>>(new Set());
  const [commonSkills, setCommonSkills] = useState<any[]>([]);
  const [showProficiencySelector, setShowProficiencySelector] = useState(false);
  const [quizGenerationInProgress, setQuizGenerationInProgress] = useState(false);
  const [questionsBySkill, setQuestionsBySkill] = useState<Record<string, QuizQuestion[]>>({});
  const [skillOrder, setSkillOrder] = useState<string[]>([]);
  const [currentSkillIndex, setCurrentSkillIndex] = useState(0);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [currentSkillCompleted, setCurrentSkillCompleted] = useState(false);
  const maxRetries = 5;
  const timeLimit = 15;

  if (viewMode) {
    return <QuizDetails quizId={quizId} isEmployer={isEmployer} />;
  }

  const handleAnswerChange = (questionId: string, answer: string) => {
    setAnswers({
      ...answers,
      [questionId]: answer,
    });
  };

  const handleTimeExpired = (questionId: string) => {
    const question = questions.find(q => q.id === questionId);
    if (question) {
      const randomIndex = Math.floor(Math.random() * question.options.length);
      const randomAnswer = question.options[randomIndex];
      
      handleAnswerChange(questionId, randomAnswer);
      
      setTimeout(() => {
        moveToNextQuestion();
      }, 1500);
    }
  };
  
  const handleSkipQuestion = (questionId: string) => {
    const newSkipped = new Set(skippedQuestions);
    newSkipped.add(questionId);
    setSkippedQuestions(newSkipped);
    
    moveToNextQuestion();
  };

  const moveToNextQuestion = () => {
    const currentSkill = skillOrder[currentSkillIndex];
    const skillQuestions = questionsBySkill[currentSkill] || [];
    
    if (currentQuestionIndex < skillQuestions.length - 1) {
      setCurrentQuestionIndex(prevIndex => prevIndex + 1);
    } else {
      setCurrentSkillCompleted(true);
    }
  };

  const moveToNextSkill = () => {
    if (currentSkillIndex < skillOrder.length - 1) {
      setCurrentSkillIndex(prevIndex => prevIndex + 1);
      setCurrentQuestionIndex(0);
      setCurrentSkillCompleted(false);
    } else {
    }
  };

  const handleSubmitQuestion = (questionId: string) => {
    moveToNextQuestion();
  };

  const updateQuizStatus = async () => {
    try {
      await supabase
        .from("quizzes")
        .update({ status: "in_progress" })
        .eq("id", quizId);
    } catch (error) {
      console.error("Error updating quiz status:", error);
    }
  };

  const getCommonSkills = async () => {
    if (!applicationId) return [];
    
    try {
      setLoading(true);
      console.log("Fetching common skills for application ID:", applicationId);
      
      const { data: application, error: appError } = await supabase
        .from("applications")
        .select("job_id")
        .eq("id", applicationId)
        .single();
        
      if (appError || !application) {
        console.error("Error fetching application:", appError);
        return [];
      }
      
      const jobId = application.job_id;
      console.log("Found job ID:", jobId);
      
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        console.error("No authenticated user found");
        return [];
      }
      
      const { data: jobSkills, error: jobSkillsError } = await supabase
        .from("job_skills")
        .select(`
          skill_id,
          importance,
          skills (
            id,
            name
          )
        `)
        .eq("job_id", jobId);
        
      if (jobSkillsError) {
        console.error("Error fetching job skills:", jobSkillsError);
        return [];
      }
      console.log("Job skills:", jobSkills);
      
      const jobSkillsData = jobSkills.map(skill => ({
        id: skill.skill_id,
        name: skill.skills.name,
        proficiency: skill.importance,
        importance: skill.importance
      }));
      
      console.log("Using job skills directly:", jobSkillsData);
      setCommonSkills(jobSkillsData);
      
      if (jobSkillsData.length > 0) {
        await generateQuizWithOpenAI(jobSkillsData);
      } else {
        console.log("No job skills found, fetching existing questions");
        await fetchQuizQuestions();
      }
      
      return jobSkillsData;
    } catch (error) {
      console.error("Error getting job skills:", error);
      await fetchQuizQuestions();
      return [];
    } finally {
      setLoading(false);
    }
  };

  const generateQuizWithOpenAI = async (skillsWithProficiency: any[]) => {
    try {
      setQuizGenerationInProgress(true);
      console.log("Generating quiz with skills:", skillsWithProficiency);
      
      try {
        const { error: deleteError } = await supabase
          .from("quiz_questions")
          .delete()
          .eq("quiz_id", quizId);
          
        if (deleteError) {
          console.error("Error deleting existing questions:", deleteError);
        }
      } catch (deleteError) {
        console.error("Exception deleting questions:", deleteError);
      }
      
      try {
        const { data, error } = await supabase.functions.invoke("generate-quiz-questions", {
          body: { 
            skills: skillsWithProficiency,
            questionsPerSkill: 10,
            quizId: quizId,
            applicationId: applicationId
          }
        });

        if (error) {
          console.error("Error invoking generate-quiz-questions function:", error);
          throw error;
        }

        console.log("Quiz generation response:", data);
        
        if (data && data.quizId) {
          setTimeout(async () => {
            await fetchQuizQuestions();
          }, 3000);
        }
      } catch (invokeError) {
        console.error("Exception invoking function:", invokeError);
        toast({
          title: "Error generating quiz",
          description: "Failed to generate quiz questions. Using default questions instead.",
        });
        
        setTimeout(async () => {
          await fetchQuizQuestions();
        }, 3000);
      }
    } catch (error) {
      console.error("Error generating quiz with OpenAI:", error);
      toast({
        title: "Error generating quiz",
        description: "Failed to generate quiz questions. Please try again.",
        variant: "destructive",
      });
      await fetchQuizQuestions();
    } finally {
      setQuizGenerationInProgress(false);
    }
  };

  const fetchQuizQuestions = async () => {
    try {
      setLoading(true);
      setRetryInProgress(true);
      console.log(`Fetching questions for quiz ID: ${quizId}`);

      const { data, error } = await supabase
        .from("quiz_questions")
        .select("*, skills(id, name)")
        .eq("quiz_id", quizId);

      if (error) {
        throw error;
      }

      console.log(`Found ${data?.length || 0} questions for quiz ID: ${quizId}`, data);

      const parsedQuestions = (data || []).map(q => ({
        ...q,
        options: typeof q.options === 'string' ? JSON.parse(q.options) : q.options
      }));

      setQuestions(parsedQuestions);
      
      const groupedQuestions: Record<string, QuizQuestion[]> = {};
      const skillIds: string[] = [];
      
      parsedQuestions.forEach(question => {
        const skillId = question.skill_id;
        if (!groupedQuestions[skillId]) {
          groupedQuestions[skillId] = [];
          skillIds.push(skillId);
        }
        groupedQuestions[skillId].push(question);
      });
      
      setQuestionsBySkill(groupedQuestions);
      setSkillOrder(skillIds);
      
    } catch (error: any) {
      console.error("Error fetching quiz questions:", error);
      toast({
        title: "Error fetching quiz questions",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
      setRetryInProgress(false);
    }
  };

  const handleSubmitQuiz = async () => {
    try {
      setSubmitting(true);

      let correctAnswers = 0;
      const skillScores: Record<string, { correct: number, total: number }> = {};

      for (const skillId of skillOrder) {
        skillScores[skillId] = { correct: 0, total: 0 };
      }

      for (const question of questions) {
        const userAnswer = answers[question.id];
        const isCorrect = userAnswer === question.correct_answer;
        const wasSkipped = skippedQuestions.has(question.id);
        
        if (question.skill_id) {
          skillScores[question.skill_id].total += 1;
          if (isCorrect) {
            skillScores[question.skill_id].correct += 1;
            correctAnswers++;
          }
        }

        await supabase.from("quiz_answers").insert({
          question_id: question.id,
          answer: wasSkipped ? 'SKIPPED' : userAnswer,
          is_correct: isCorrect,
        });
      }

      const percentageSkillScores: Record<string, number> = {};
      for (const [skillId, score] of Object.entries(skillScores)) {
        if (score.total > 0) {
          percentageSkillScores[skillId] = Math.round((score.correct / score.total) * 100);
        } else {
          percentageSkillScores[skillId] = 0;
        }
      }

      const overallScore = Math.round((correctAnswers / questions.length) * 100);

      await supabase
        .from("quizzes")
        .update({
          status: "completed",
          score: overallScore,
          skill_scores: percentageSkillScores,
          completed_at: new Date().toISOString(),
        })
        .eq("id", quizId);

      if (applicationId) {
        await supabase
          .from("applications")
          .update({
            status: "quiz_completed",
            updated_at: new Date().toISOString(),
          })
          .eq("id", applicationId);
      }

      toast({
        title: "Quiz Completed",
        description: `You scored ${overallScore}% overall. Your application has been updated.`,
      });

      onComplete();
    } catch (error: any) {
      console.error("Error submitting quiz:", error);
      toast({
        title: "Error submitting quiz",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleProficiencyComplete = (skillsWithProficiency: any[]) => {
    console.log("Proficiency selection complete. Selected proficiencies:", skillsWithProficiency);
    setShowProficiencySelector(false);
    generateQuizWithOpenAI(skillsWithProficiency);
  };

  useEffect(() => {
    if (questions.length === 0 && retryCount < maxRetries && !loading && !retryInProgress && !quizGenerationInProgress && !showProficiencySelector) {
      const timer = setTimeout(() => {
        console.log(`Auto-retrying to fetch questions (attempt ${retryCount + 1}/${maxRetries})...`);
        setRetryInProgress(true);
        fetchQuizQuestions().finally(() => {
          setRetryInProgress(false);
          setRetryCount(prev => prev + 1);
        });
      }, 5000);
      
      return () => clearTimeout(timer);
    }
  }, [questions, loading, retryCount, retryInProgress, quizGenerationInProgress, showProficiencySelector]);

  useEffect(() => {
    updateQuizStatus();
    getCommonSkills();
  }, [quizId, applicationId]);

  if (showProficiencySelector) {
    return <ProficiencySelector skills={commonSkills} onComplete={handleProficiencyComplete} />;
  }

  if (loading || retryInProgress || quizGenerationInProgress) {
    return (
      <QuizLoading 
        isRefreshing={retryInProgress || quizGenerationInProgress} 
      />
    );
  }

  if (questions.length === 0) {
    return (
      <QuizEmpty 
        retryCount={retryCount} 
        maxRetries={maxRetries} 
        onRefresh={fetchQuizQuestions}
        isRefreshing={retryInProgress}
      />
    );
  }

  const currentSkill = skillOrder[currentSkillIndex];
  const currentSkillName = questionsBySkill[currentSkill]?.[0]?.skills?.name || "Unknown Skill";
  const currentSkillQuestions = questionsBySkill[currentSkill] || [];
  const currentQuestion = currentSkillQuestions[currentQuestionIndex];
  
  const allSkillsCompleted = currentSkillIndex === skillOrder.length - 1 && 
                            currentSkillCompleted;
                            
  const totalAnswered = Object.keys(answers).length;
  const totalQuestions = questions.length;
  const progress = (totalAnswered / totalQuestions) * 100;

  return (
    <div className="space-y-6">
      <div className="flex flex-col space-y-4">
        <div className="flex justify-between items-center">
          <h3 className="text-lg font-medium">
            Skill: {currentSkillName}
          </h3>
          <span className="text-sm text-gray-500">
            Question {currentQuestionIndex + 1} of {currentSkillQuestions.length}
          </span>
        </div>
        
        <Progress value={progress} className="h-2" />
        
        <p className="text-sm text-gray-500">
          Complete the questions for this skill before moving to the next one.
        </p>
      </div>

      {currentSkillCompleted ? (
        <Card className="p-6 text-center">
          <h3 className="text-lg font-medium mb-4">
            You've completed all questions for {currentSkillName}
          </h3>
          
          {currentSkillIndex < skillOrder.length - 1 ? (
            <Button onClick={moveToNextSkill}>
              Continue to Next Skill <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          ) : (
            <Button onClick={handleSubmitQuiz} disabled={submitting}>
              {submitting ? (
                <span className="flex items-center">
                  <span className="animate-spin mr-2 h-4 w-4 border-t-2 border-b-2 border-white rounded-full"></span>
                  Submitting Quiz...
                </span>
              ) : (
                <span className="flex items-center">
                  <Check className="mr-2 h-4 w-4" />
                  Submit Quiz
                </span>
              )}
            </Button>
          )}
        </Card>
      ) : (
        <div className="space-y-6">
          {currentSkillQuestions.map((question, index) => (
            <QuizQuestionComponent
              key={question.id}
              question={question}
              index={index}
              answer={answers[question.id] || ""}
              onAnswerChange={(questionId, answer) => {
                handleAnswerChange(questionId, answer);
                if (index === currentQuestionIndex) {
                  setTimeout(() => moveToNextQuestion(), 500);
                }
              }}
              onTimeExpired={handleTimeExpired}
              onSkip={handleSkipQuestion}
              onSubmit={handleSubmitQuestion}
              timeLimit={timeLimit}
              isActive={index === currentQuestionIndex}
            />
          ))}
          
          <div className="flex justify-between">
            <Button 
              variant="outline"
              onClick={() => handleSkipQuestion(currentQuestion.id)}
            >
              <SkipForward className="mr-2 h-4 w-4" />
              Skip Question
            </Button>
            
            <Button 
              onClick={moveToNextQuestion} 
              disabled={!answers[currentQuestion?.id] && !skippedQuestions.has(currentQuestion?.id)}
            >
              Next Question
            </Button>
          </div>
        </div>
      )}
      
      {totalAnswered > 0 && (
        <div className="flex justify-end mt-6">
          <Button 
            onClick={handleSubmitQuiz} 
            disabled={submitting}
          >
            {submitting ? (
              <span className="flex items-center">
                <span className="animate-spin mr-2 h-4 w-4 border-t-2 border-b-2 border-white rounded-full"></span>
                Submitting...
              </span>
            ) : (
              <span className="flex items-center">
                <Check className="mr-2 h-4 w-4" />
                Submit Quiz Now
              </span>
            )}
          </Button>
        </div>
      )}
    </div>
  );
};

export const QuizManager = ({ 
  showPracticeQuizzes = false 
}: { 
  showPracticeQuizzes?: boolean 
}) => {
  const { userProfile } = useAuth();
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedQuiz, setSelectedQuiz] = useState<Quiz | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [viewingCompleted, setViewingCompleted] = useState(false);

  const fetchQuizzes = async () => {
    if (!userProfile?.id) return;
    
    try {
      setLoading(true);
      
      const { data: applications, error: appError } = await supabase
        .from("applications")
        .select("id")
        .eq("employee_id", userProfile.id);
      
      if (appError) throw appError;
      
      if (!applications || applications.length === 0) {
        setQuizzes([]);
        return;
      }
      
      const applicationIds = applications.map(app => app.id);
      
      const { data, error } = await supabase
        .from("quizzes")
        .select(`
          *,
          applications(
            jobs(
              id, title
            )
          ),
          quiz_questions:quiz_questions(count)
        `)
        .in("application_id", applicationIds)
        .order("created_at", { ascending: false });

      if (error) throw error;
      
      const transformedData = data?.map(quiz => ({
        ...quiz,
        quiz_questions_count: quiz.quiz_questions && quiz.quiz_questions[0] ? quiz.quiz_questions[0].count : 0
      })) || [];
      
      setQuizzes(transformedData);
    } catch (error: any) {
      console.error("Error fetching quizzes:", error);
      toast({
        title: "Error fetching quizzes",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (userProfile?.id) {
      fetchQuizzes();
    }
  }, [userProfile]);

  if (loading) {
    return (
      <div className="flex justify-center py-8">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (quizzes.length === 0) {
    return (
      <div className="text-center py-8 space-y-4">
        <p className="text-lg text-gray-500">
          You don't have any job assessments yet. Apply for a job to get a skills assessment.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {quizzes.map((quiz) => (
        <Card key={quiz.id} className="overflow-hidden">
          <div className="p-6">
            <div className="flex justify-between items-start">
              <div>
                <h3 className="text-lg font-medium">
                  {quiz.applications?.jobs?.title || "Untitled Job"}
                </h3>
                <div className="flex items-center mt-1 space-x-3">
                  <span className="text-sm text-gray-500">
                    Created: {new Date(quiz.created_at).toLocaleDateString()}
                  </span>
                  <div className="flex items-center">
                    <span className={`inline-block w-2 h-2 rounded-full mr-2 ${
                      quiz.status === 'completed' ? 'bg-green-500' : 
                      quiz.status === 'in_progress' ? 'bg-amber-500' : 'bg-gray-500'
                    }`}></span>
                    <span className="text-sm capitalize">{quiz.status.replace('_', ' ')}</span>
                  </div>
                </div>
              </div>
              <div className="text-right">
                {quiz.status === 'completed' && quiz.score !== null ? (
                  <div className="space-y-2">
                    <div className="text-lg font-semibold">
                      Score: {quiz.score}%
                    </div>
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => {
                        setSelectedQuiz(quiz);
                        setViewingCompleted(true);
                        setDialogOpen(true);
                      }}
                    >
                      <Eye className="h-4 w-4 mr-2" />
                      View Answers
                    </Button>
                  </div>
                ) : (
                  <Button 
                    onClick={() => {
                      setSelectedQuiz(quiz);
                      setViewingCompleted(false);
                      setDialogOpen(true);
                    }}
                    disabled={quiz.quiz_questions_count === 0}
                  >
                    {quiz.status === 'pending' ? 'Start Quiz' : 'Continue Quiz'}
                  </Button>
                )}
              </div>
            </div>
          </div>
        </Card>
      ))}

      {dialogOpen && selectedQuiz && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-semibold">
                  {selectedQuiz.applications?.jobs?.title || "Skills Assessment"}
                </h2>
                <Button 
                  variant="ghost" 
                  onClick={() => {
                    setDialogOpen(false);
                    setSelectedQuiz(null);
                    setViewingCompleted(false);
                    fetchQuizzes();
                  }}
                >
                  Close
                </Button>
              </div>
              
              {viewingCompleted ? (
                <QuizTaker
                  quizId={selectedQuiz.id}
                  applicationId={selectedQuiz.application_id}
                  onComplete={() => {}}
                  viewMode={true}
                  isEmployer={false}
                />
              ) : (
                <QuizTaker 
                  quizId={selectedQuiz.id}
                  applicationId={selectedQuiz.application_id}
                  onComplete={() => {
                    setDialogOpen(false);
                    setSelectedQuiz(null);
                    fetchQuizzes();
                  }}
                />
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
