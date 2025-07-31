
import React, { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "@/components/ui/use-toast";
import { Loader2 } from "lucide-react";
import { QuizTaker } from "./Quiz";

const QuizGenerator: React.FC = () => {
  const { userProfile } = useAuth();
  const [loading, setLoading] = useState(false);
  const [quizId, setQuizId] = useState<string | null>(null);
  const [showQuiz, setShowQuiz] = useState(false);

  const handleGenerateQuiz = async () => {
    if (!userProfile?.id) {
      toast({
        title: "Authentication Required",
        description: "Please sign in to generate a quiz.",
        variant: "destructive",
      });
      return;
    }

    try {
      setLoading(true);

      // Create a new quiz record
      const { data: quizData, error: quizError } = await supabase
        .from("quizzes")
        .insert({
          employee_id: userProfile.id,
          status: "pending",
        })
        .select();

      if (quizError) {
        throw quizError;
      }

      if (!quizData || quizData.length === 0) {
        throw new Error("Failed to create quiz");
      }

      const newQuizId = quizData[0].id;
      
      // Load user's skills from employee_skills
      const { data: userSkills, error: skillsError } = await supabase
        .from("employee_skills")
        .select(`
          skill_id,
          proficiency,
          skills (
            id,
            name
          )
        `)
        .eq("employee_id", userProfile.id);
        
      if (skillsError) {
        throw skillsError;
      }
      
      if (!userSkills || userSkills.length === 0) {
        toast({
          title: "No skills found",
          description: "Please add skills to your profile before generating a quiz.",
          variant: "destructive",
        });
        return;
      }
      
      // Format skills for the quiz generation
      const formattedSkills = userSkills.map(skill => ({
        id: skill.skill_id,
        name: skill.skills.name,
        proficiency: skill.proficiency
      }));
      
      // Call the OpenAI function to generate questions
      const { error: fnError } = await supabase.functions.invoke("generate-quiz-questions", {
        body: { 
          skills: formattedSkills,
          questionsPerSkill: 10,
          quizId: newQuizId
        }
      });

      if (fnError) {
        throw fnError;
      }

      setQuizId(newQuizId);
      setShowQuiz(true);
      
      toast({
        title: "Quiz Generated",
        description: "Your practice quiz has been created. Good luck!",
      });
    } catch (error: any) {
      console.error("Error generating quiz:", error);
      toast({
        title: "Error generating quiz",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleQuizComplete = () => {
    setShowQuiz(false);
    setQuizId(null);
    
    toast({
      title: "Quiz Completed",
      description: "Thanks for completing the practice quiz!",
    });
  };

  if (showQuiz && quizId) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Practice Quiz</CardTitle>
        </CardHeader>
        <CardContent>
          <QuizTaker quizId={quizId} onComplete={handleQuizComplete} />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Generate Practice Quiz</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-gray-600 mb-4">
          Generate a personalized practice quiz based on your skill profile. This will help you prepare for job assessments.
        </p>
        <div className="space-y-2 text-sm">
          <p>✓ Questions tailored to your skills</p>
          <p>✓ Instant feedback on your answers</p>
          <p>✓ Detailed breakdown of your strengths and weaknesses</p>
          <p>✓ Practice in a real assessment environment</p>
        </div>
      </CardContent>
      <CardFooter>
        <Button
          onClick={handleGenerateQuiz}
          disabled={loading}
          className="w-full"
        >
          {loading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Generating Quiz...
            </>
          ) : (
            "Generate Practice Quiz"
          )}
        </Button>
      </CardFooter>
    </Card>
  );
};

export default QuizGenerator;
