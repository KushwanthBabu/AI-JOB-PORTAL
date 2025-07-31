
import React, { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "@/components/ui/use-toast";
import { Loader2 } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface QuizDetailsProps {
  quizId: string;
  isEmployer?: boolean;
}

interface QuizQuestion {
  id: string;
  question: string;
  correct_answer: string;
  options: string[];
  skills: {
    name: string;
    id: string;
  };
  quiz_answers: {
    answer: string;
    is_correct: boolean;
  }[];
}

const QuizDetails: React.FC<QuizDetailsProps> = ({ quizId, isEmployer = false }) => {
  const [loading, setLoading] = useState(true);
  const [quiz, setQuiz] = useState<any>(null);
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [application, setApplication] = useState<any>(null);
  const { userProfile } = useAuth();

  useEffect(() => {
    fetchQuizDetails();
  }, [quizId]);

  const fetchQuizDetails = async () => {
    try {
      setLoading(true);
      
      // Fetch the quiz details
      const { data: quizData, error: quizError } = await supabase
        .from("quizzes")
        .select("*, applications(*)")
        .eq("id", quizId)
        .single();
      
      if (quizError) throw quizError;
      setQuiz(quizData);
      
      if (quizData.application_id) {
        const { data: appData, error: appError } = await supabase
          .from("applications")
          .select("*, jobs(*)")
          .eq("id", quizData.application_id)
          .single();
        
        if (!appError) {
          setApplication(appData);
        }
      }
      
      // Fetch questions with answers
      const { data: questionsData, error: questionsError } = await supabase
        .from("quiz_questions")
        .select(`
          id,
          question,
          options,
          correct_answer,
          skill_id,
          skills:skills(id, name),
          quiz_answers(answer, is_correct)
        `)
        .eq("quiz_id", quizId);
      
      if (questionsError) throw questionsError;
      
      // Parse options if they're stored as a string
      const parsedQuestions = questionsData.map((q: any) => ({
        ...q,
        options: typeof q.options === 'string' ? JSON.parse(q.options) : q.options
      }));
      
      setQuestions(parsedQuestions);
    } catch (error: any) {
      console.error("Error fetching quiz details:", error);
      toast({
        title: "Error loading quiz details",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  // Check if the user should be able to see the score
  const canViewScore = () => {
    if (isEmployer) return true;
    
    if (!application) return false;
    
    // Employees can see scores if the application status is one of these
    const viewableStatuses = ["interview", "accepted", "rejected"];
    return viewableStatuses.includes(application.status);
  };

  // Group questions by skill to show scores by skill
  const questionsBySkill = questions.reduce((acc: Record<string, any[]>, question) => {
    const skillId = question.skills?.id;
    const skillName = question.skills?.name;
    
    if (skillId && skillName) {
      if (!acc[skillId]) {
        acc[skillId] = [];
      }
      acc[skillId].push(question);
    }
    
    return acc;
  }, {});

  // Calculate scores by skill
  const calculateSkillScores = () => {
    const scores: Record<string, { name: string, correct: number, total: number, percentage: number }> = {};
    
    Object.entries(questionsBySkill).forEach(([skillId, skillQuestions]) => {
      const total = skillQuestions.length;
      let correct = 0;
      
      skillQuestions.forEach(question => {
        if (question.quiz_answers && question.quiz_answers.length > 0) {
          if (question.quiz_answers[0].is_correct) {
            correct++;
          }
        }
      });
      
      const percentage = total > 0 ? Math.round((correct / total) * 100) : 0;
      
      scores[skillId] = {
        name: skillQuestions[0].skills.name,
        correct,
        total,
        percentage
      };
    });
    
    return scores;
  };

  if (loading) {
    return (
      <div className="flex justify-center py-8">
        <div className="flex flex-col items-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="mt-2 text-sm text-gray-500">Loading quiz details...</p>
        </div>
      </div>
    );
  }

  if (!quiz) {
    return (
      <div className="text-center py-8">
        <p className="text-gray-500">Quiz not found or you don't have permission to view it.</p>
      </div>
    );
  }

  // Get skill scores from quiz.skill_scores if available, otherwise calculate them
  const skillScores = quiz.skill_scores || calculateSkillScores();

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Quiz Results</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            {canViewScore() ? (
              <>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-medium">Overall Score</h3>
                    <span className="text-2xl font-bold">{quiz.score}%</span>
                  </div>
                  <Progress value={quiz.score} className="h-2" />
                  <p className="text-sm text-gray-500">
                    Completed on: {new Date(quiz.completed_at).toLocaleString()}
                  </p>
                </div>
                
                <div className="mt-6">
                  <h3 className="text-lg font-medium mb-4">Scores by Skill</h3>
                  <div className="space-y-4">
                    {Object.entries(skillScores).map(([skillId, score]: [string, any]) => (
                      <div key={skillId} className="space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="font-medium">{score.name}</span>
                          <span className="font-semibold">{score.percentage}%</span>
                        </div>
                        <Progress value={score.percentage} className="h-1.5" />
                        {typeof score.correct !== 'undefined' && (
                          <p className="text-xs text-gray-500">
                            {score.correct} out of {score.total} questions correct
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </>
            ) : (
              <div className="text-center py-4">
                <p className="text-gray-500">
                  Quiz score will be available after the application has been reviewed by the employer.
                </p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {canViewScore() && (
        <Card>
          <CardHeader>
            <CardTitle>Questions and Answers</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-8">
              {isEmployer && (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Question</TableHead>
                      <TableHead>Employee Answer</TableHead>
                      <TableHead>Correct Answer</TableHead>
                      <TableHead className="text-right">Result</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {questions.map((question) => {
                      const userAnswer = question.quiz_answers && question.quiz_answers[0] ? 
                        question.quiz_answers[0].answer : "Not answered";
                      const isCorrect = question.quiz_answers && question.quiz_answers[0] ? 
                        question.quiz_answers[0].is_correct : false;
                      const isSkipped = userAnswer === "SKIPPED";
                      
                      return (
                        <TableRow key={question.id}>
                          <TableCell className="font-medium">{question.question}</TableCell>
                          <TableCell>
                            {isSkipped ? (
                              <span className="px-2 py-1 text-xs bg-gray-200 text-gray-700 rounded">Skipped</span>
                            ) : (
                              userAnswer
                            )}
                          </TableCell>
                          <TableCell>{question.correct_answer}</TableCell>
                          <TableCell className="text-right">
                            {isSkipped ? (
                              <span className="px-2 py-1 text-xs bg-gray-200 text-gray-700 rounded">Skipped</span>
                            ) : (
                              <span className={`px-2 py-1 text-xs ${isCorrect ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'} rounded`}>
                                {isCorrect ? 'Correct' : 'Incorrect'}
                              </span>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
              
              {!isEmployer && (
                Object.entries(questionsBySkill).map(([skillId, skillQuestions]) => (
                  <div key={skillId} className="space-y-4">
                    <h3 className="text-lg font-medium border-b pb-2">
                      {skillQuestions[0].skills.name}
                    </h3>
                    
                    {skillQuestions.map((question, index) => {
                      const userAnswer = question.quiz_answers && question.quiz_answers[0] ? 
                        question.quiz_answers[0].answer : "Not answered";
                      const isCorrect = question.quiz_answers && question.quiz_answers[0] ? 
                        question.quiz_answers[0].is_correct : false;
                      const isSkipped = userAnswer === "SKIPPED";
                      
                      return (
                        <div key={question.id} className="space-y-2 p-4 border rounded-md">
                          <div className="flex items-start justify-between">
                            <h4 className="font-medium">{index + 1}. {question.question}</h4>
                            {isSkipped ? (
                              <span className="px-2 py-1 text-xs bg-gray-200 text-gray-700 rounded">Skipped</span>
                            ) : (
                              <span className={`px-2 py-1 text-xs ${isCorrect ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'} rounded`}>
                                {isCorrect ? 'Correct' : 'Incorrect'}
                              </span>
                            )}
                          </div>
                          
                          {!isSkipped && (
                            <div className="space-y-1 mt-2">
                              <p className="text-sm"><span className="font-medium">Your answer:</span> {userAnswer}</p>
                              {!isCorrect && (
                                <p className="text-sm"><span className="font-medium">Correct answer:</span> {question.correct_answer}</p>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default QuizDetails;
