import type { Experience } from "../types";

export const experiences: Experience[] = [
  {
    company: "Pipeworks Studios",
    date: "2025 - Present",
    title: "Game engineer on unannounced original title",
    link: "https://www.pipeworks.com/",
    role: "Game Engineering Intern",
    bullets: [
      "Gained production-level experience in Unreal Engine and C#.",
      "Learned version control principles and practices.",
      "Worked alongside full-time engineers and designers.",
    ],
    skills: [
      { icon: "/assets/img/ue5-icon.png", label: "Unreal Engine" },
      { icon: "/assets/img/cs.png", label: "C#" },
      { icon: "/assets/img/p4v.png", label: "Version Control" },
    ],
    image: { src: "/assets/img/pipeworks_team.jpeg", alt: "Pipeworks Studios" },
  },
  {
    company: "QuackHacks",
    date: "2024 - Present",
    title: "Founded University of Oregon's student-run hackathon",
    link: "https://www.quackhacks.org/",
    role: "Event Director / Founder",
    bullets: [
      "Hosted 2 hackathons valued over $30,000.",
      "Logistics for 24-hour, 150+ person events.",
      "Active development on 3 hackathons.",
      "Led a team of 25 student organizers.",
      "Registered non-profit with the state of Oregon.",
    ],
    skills: [
      { icon: "/assets/img/uo_yellow.png", label: "University Newsletter" },
      { icon: "/assets/img/E-Logo-GRN.png", label: "Student Paper" },
      { icon: "/assets/img/kezi9.png", label: "Local News" },
    ],
    image: { src: "/assets/img/quackhacks.jpeg", alt: "QuackHacks" },
  },
  {
    company: "DermoAI",
    date: "2025",
    title: "Developed melanoma & skin disease deep learning models",
    link: "https://devpost.com/software/dermo",
    role: "Hackathon Project Member, UI/UX & Frontend Lead",
    bullets: [
      "BeaverHacks Best Overall Presented by NVIDIA.",
      "85% accurate melanoma detection model.",
      "The largest open-source skin disease dataset.",
      "Led UI/UX design and frontend development.",
    ],
    skills: [
      { icon: "/assets/img/react.png", label: "React" },
      { icon: "/assets/img/tailwindcss.png", label: "Tailwind CSS" },
      { icon: "/assets/img/pytorch.png", label: "PyTorch" },
    ],
    image: { src: "/assets/img/bh_stage.jpg", alt: "DermoAI" },
  },
  {
    company: "University of Oregon",
    date: "M.S. June 2027",
    title: "Accelerated Master's program in Computer Science.",
    role: "Sociology minor",
    bullets: [
      "Computer Science B.S. December 2025.",
      "Learning assistant for intro-level courses.",
      "Concentration in Software Development.",
      "Project-based learning in Machine Learning, Mobile Development, and Game Development.",
    ],
    skills: "System Architecture | Data Structures | Algorithms",
    image: { src: "/assets/img/uo_crop.jpg", alt: "University of Oregon" },
  },
];
