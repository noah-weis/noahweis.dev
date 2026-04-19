export interface Skill {
  icon?: string;
  label: string;
}

export interface Experience {
  company: string;
  date: string;
  title: string;
  link?: string;
  role: string;
  bullets: string[];
  skills: Skill[] | string;
  image: { src: string; alt: string };
}
