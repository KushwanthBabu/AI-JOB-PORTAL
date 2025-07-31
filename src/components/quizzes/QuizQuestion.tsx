
import React, { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { QuizQuestion as QuestionType } from "./Quiz";
import { Progress } from "@/components/ui/progress";
import { Clock, SkipForward, Check } from "lucide-react";
import { Button } from "@/components/ui/button";

interface QuizQuestionProps {
  question: QuestionType;
  index: number;
  answer: string;
  onAnswerChange: (questionId: string, answer: string) => void;
  onTimeExpired: (questionId: string) => void;
  onSkip: (questionId: string) => void;
  onSubmit: (questionId: string) => void;
  timeLimit?: number;
  isActive: boolean;
}

const QuizQuestion: React.FC<QuizQuestionProps> = ({
  question,
  index,
  answer,
  onAnswerChange,
  onTimeExpired,
  onSkip,
  onSubmit,
  timeLimit = 15, // 15 second time limit
  isActive,
}) => {
  const [timeRemaining, setTimeRemaining] = useState(timeLimit);
  const [timerActive, setTimerActive] = useState(false);
  
  useEffect(() => {
    // Reset and activate timer when the question becomes active
    if (isActive) {
      setTimeRemaining(timeLimit);
      setTimerActive(true);
    } else {
      setTimerActive(false);
    }
  }, [isActive, timeLimit]);
  
  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;
    
    if (timerActive && timeRemaining > 0) {
      interval = setInterval(() => {
        setTimeRemaining((prev) => prev - 1);
      }, 1000);
    } else if (timeRemaining === 0 && timerActive) {
      setTimerActive(false);
      onTimeExpired(question.id);
    }
    
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [timerActive, timeRemaining, question.id, onTimeExpired]);
  
  const progressPercentage = (timeRemaining / timeLimit) * 100;
  
  // If the question is not active, don't render it at all
  if (!isActive) {
    return null;
  }
  
  return (
    <Card key={question.id}>
      <CardContent className="pt-6">
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="font-medium">
              {index + 1}. {question.question}
            </h3>
            <div className="flex items-center space-x-2">
              <Clock className="h-4 w-4 text-gray-500" />
              <span className={`${timeRemaining < 10 ? "text-red-500 font-bold" : "text-gray-500"}`}>
                {timeRemaining}s
              </span>
            </div>
          </div>
          
          <Progress value={progressPercentage} className={`h-1 ${progressPercentage < 30 ? "bg-red-100" : ""}`} />
          
          <p className="text-sm text-gray-500">
            Skill: {question.skills?.name || "Unknown"}
          </p>

          <RadioGroup
            value={answer || ""}
            onValueChange={(value) => onAnswerChange(question.id, value)}
            disabled={timeRemaining === 0}
          >
            {question.options.map((option: string) => (
              <div key={option} className="flex items-center space-x-2">
                <RadioGroupItem value={option} id={`${question.id}-${option}`} disabled={timeRemaining === 0} />
                <Label htmlFor={`${question.id}-${option}`}>{option}</Label>
              </div>
            ))}
          </RadioGroup>
          
          {timeRemaining === 0 && (
            <p className="text-red-500 text-sm font-medium mt-2">
              Time expired! The system will automatically move to the next question.
            </p>
          )}
          
          <div className="flex justify-end gap-2 mt-4">
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => onSkip(question.id)}
            >
              <SkipForward className="h-4 w-4 mr-1" /> Skip
            </Button>
            {answer && (
              <Button 
                variant="default" 
                size="sm" 
                onClick={() => onSubmit(question.id)}
              >
                <Check className="h-4 w-4 mr-1" /> Submit
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default QuizQuestion;

