export const questions = [
  {
    id: 1,
    question: "Hey there, what brings you here today?",
    options: [
      { id: 1, text: "Work", value: "work" },
      { id: 2, text: "Personal", value: "personal" },
      { id: 3, text: "School", value: "school" },
      { id: 4, text: "Nonprofits", value: "nonprofits" },
    ],
    svg: "",
  },
  {
    id: 2,
    question: "What describes your current role?",
    options: [
      { id: 1, text: "Business owner", value: "businessOwner" },
      { id: 2, text: "Team Leader", value: "teamLeader" },
      { id: 3, text: "Team Member", value: "teamMember" },
      { id: 4, text: "Freelancer", value: "freelancer" },
      { id: 5, text: "Director", value: "director" },
      { id: 6, text: "C-Level", value: "cLevel" },
      { id: 7, text: "VP", value: "vp" },
    ],
    svg: "",
  },
  {
    id: 4,
    question: "How many people work at your company?",
    options: [
      { id: 1, text: "1-19", value: "1-19" },
      { id: 2, text: "20-49", value: "20-49" },
      { id: 3, text: "50-99", value: "50-99" },
      { id: 4, text: "100-250", value: "100-250" },
      { id: 5, text: "251-500", value: "251-500" },
      { id: 6, text: "501-1500", value: "501-1500" },
      { id: 7, text: "1500+", value: "1500+" },
    ],
    svg: "",
  },
  {
    id: 5,
    question: "One last question, select what you'd like to manage first",
    options: [
      { id: 1, text: "Education", value: "education" },
      { id: 2, text: "Sales and CRM", value: "salesAndCRM" },
      { id: 3, text: "Design and Creative", value: "designAndCreative" },
      { id: 4, text: "Product Management", value: "productManagement" },
      { id: 5, text: "IT", value: "it" },
      { id: 6, text: "HR and Recruiting", value: "hrAndRecruiting" },
      { id: 7, text: "Software Development", value: "softwareDevelopment" },
      { id: 8, text: "Legal", value: "legal" },
      { id: 9, text: "Construction", value: "construction" },
      { id: 14, text: "Marketing", value: "marketing" },
      { id: 15, text: "Other", value: "other" },
    ],
    svg: "",
  },
];

interface BaseQuestion {
  id: string | number;
  question: string;
}

interface OptionQuestion extends BaseQuestion {
  options: { id: number; text: string; value: string }[];
  svg?: string;
  type?: "option";
}

interface InputQuestion extends BaseQuestion {
  description: string;
  inputLabel: string;
  placeholder: string;
  type: "input";
}

export type QuestionType = OptionQuestion | InputQuestion;
