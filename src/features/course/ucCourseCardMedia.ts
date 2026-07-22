import type { CourseCatalogEntry } from "../../lib/courseCatalog";

interface UcCourseCardMedia {
  alt: string;
  src: string;
}

const UC_COURSE_MEDIA_BY_CATEGORY: Readonly<Record<string, UcCourseCardMedia>> = {
  "Built Environment": {
    alt: "A construction professional working on a building site",
    src: "/content/dam/uc/imagery/faculties/built-environment/Builder-in-safety-gear-against-a-construction-site.jpg",
  },
  Business: {
    alt: "Business professionals discussing ideas at a whiteboard",
    src: "/content/dam/uc/imagery/faculties/business/Business-professionals-discussing-stats-against-a-whiteboard-full-of-notes.jpg",
  },
  Communication: {
    alt: "Communication students collaborating at a desk",
    src: "/content/dam/uc/imagery/faculties/communication-and-media/Young-women-smiling-and-working-on-a-cluttered-desk.jpg",
  },
  Education: {
    alt: "An education student studying online",
    src: "/content/dam/uc/imagery/faculties/education/uc-education-study-online.jpg",
  },
  Health: {
    alt: "University of Canberra health students learning together",
    src: "/content/dam/uc/imagery/faculties/health/health-hero-image-1920x1080.jpg",
  },
  Law: {
    alt: "Law students taking part in a mock trial",
    src: "/content/dam/uc/imagery/faculties/law/Women-speaking-on-a-podium-while-in-a-room-with-multiple-people-holding-a-mock-trial.jpg",
  },
  "Politics & Society": {
    alt: "Participants in a University of Canberra public-policy program",
    src: "/content/dam/uc/imagery/faculties/politics-economics-and-society/about-pathways-to-politics.jpg",
  },
  Technology: {
    alt: "Technology students collaborating on a drone project",
    src: "/content/dam/uc/imagery/faculties/technology/Two-stuednts-working-together-on-a-drone.jpg",
  },
};

const DEFAULT_UC_COURSE_MEDIA = UC_COURSE_MEDIA_BY_CATEGORY.Business;

const UC_COURSE_MEDIA_BY_SUBJECT: ReadonlyArray<readonly [RegExp, string]> = [
  [/built environment|building|construction|architecture/, "Built Environment"],
  [/communication|media|journalism/, "Communication"],
  [/education|teaching|languages/, "Education"],
  [/health|counselling|psychology|social work|human services/, "Health"],
  [/law|legal|juris/, "Law"],
  [/business|management|marketing|leadership/, "Business"],
  [/government|politics|public policy|public administration|policy/, "Politics & Society"],
  [/technology|data|analytics|cyber|digital|stem/, "Technology"],
];

export function getUcCourseCardMedia(
  course: Pick<CourseCatalogEntry, "categories" | "subjectArea">,
): UcCourseCardMedia {
  const subjectArea = course.subjectArea?.toLowerCase() ?? "";
  const subjectCategory = UC_COURSE_MEDIA_BY_SUBJECT.find(([matcher]) =>
    matcher.test(subjectArea),
  )?.[1];

  if (subjectCategory) {
    return UC_COURSE_MEDIA_BY_CATEGORY[subjectCategory];
  }

  const matchingCategory = course.categories.find(
    (category) => UC_COURSE_MEDIA_BY_CATEGORY[category],
  );

  return matchingCategory
    ? UC_COURSE_MEDIA_BY_CATEGORY[matchingCategory]
    : DEFAULT_UC_COURSE_MEDIA;
}
