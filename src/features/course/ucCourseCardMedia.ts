import type { CourseCatalogEntry } from "../../lib/courseCatalog";

interface UcCourseCardMedia {
  alt: string;
  src: string;
}

type UcCourseMediaPool = readonly [
  UcCourseCardMedia,
  ...UcCourseCardMedia[],
];

const UC_COURSE_MEDIA_BY_CATEGORY: Readonly<Record<string, UcCourseMediaPool>> = {
  "Built Environment": [
    {
      alt: "A construction professional working on a building site",
      src: "/content/dam/uc/imagery/faculties/built-environment/Builder-in-safety-gear-against-a-construction-site.jpg",
    },
    {
      alt: "A University of Canberra built-environment laser laboratory",
      src: "/content/dam/uc/imagery/faculties/built-environment/Built-Environment-facility-highlight-laser-lab.jpg",
    },
  ],
  Business: [
    {
      alt: "Business professionals discussing ideas at a whiteboard",
      src: "/content/dam/uc/imagery/faculties/business/Business-professionals-discussing-stats-against-a-whiteboard-full-of-notes.jpg",
    },
    {
      alt: "A University of Canberra business student",
      src: "/content/dam/uc/imagery/faculties/business/business-meets-govt.jpg",
    },
    {
      alt: "A business professional speaking with a customer",
      src: "/content/dam/uc/imagery/faculties/business/experience-receptionist-business.jpg",
    },
    {
      alt: "A University of Canberra business student on campus",
      src: "/content/dam/uc/imagery/faculties/business/business-study.jpg",
    },
  ],
  Communication: [
    {
      alt: "A communication student studying online",
      src: "/content/dam/uc/imagery/faculties/communication-and-media/Young-women-smiling-and-working-on-a-cluttered-desk.jpg",
    },
    {
      alt: "A camera operator recording an interview in a UC television studio",
      src: "/content/dam/uc/imagery/faculties/communication-and-media/CommunicationMedia-learning-space-TV-studio.jpg",
    },
    {
      alt: "Communication students presenting in the UCFM radio studio",
      src: "/content/dam/uc/imagery/faculties/communication-and-media/ucfm-comms-media.jpg",
    },
    {
      alt: "University of Canberra communication students on campus",
      src: "/content/dam/uc/imagery/faculties/communication-and-media/CommunicationMedia-work-integrated-learning-students-sabrina-eddison-rose-resized.jpg",
    },
  ],
  Education: [
    {
      alt: "An education student working with a young learner",
      src: "/content/dam/uc/imagery/faculties/education/uc-education-study-online.jpg",
    },
    {
      alt: "A teacher in a primary-school classroom",
      src: "/content/dam/uc/imagery/faculties/education/commonwealth-teaching-scholarships.jpg",
    },
    {
      alt: "Education students walking through a UC learning space",
      src: "/content/dam/uc/imagery/faculties/education/act-teacher-scholarships-summary-card.jpg",
    },
    {
      alt: "A teacher standing in front of a classroom whiteboard",
      src: "/content/dam/uc/imagery/faculties/education/NSW-teacher-education-scholarship.jpg",
    },
  ],
  Health: [
    {
      alt: "University of Canberra health students learning together",
      src: "/content/dam/uc/imagery/faculties/health/health-hero-image-1920x1080.jpg",
    },
    {
      alt: "A health student completing laboratory work",
      src: "/content/dam/uc/imagery/faculties/health/Work-Integrated-Learning.jpg",
    },
    {
      alt: "A practitioner working with a patient in a UC health clinic",
      src: "/content/dam/uc/imagery/faculties/health/uc-health-clinic.jpg",
    },
    {
      alt: "UC health students practising clinical skills",
      src: "/content/dam/uc/imagery/faculties/health/health-study-nursing-with-uc.jpg",
    },
  ],
  Law: [
    {
      alt: "Law students taking part in a mock trial",
      src: "/content/dam/uc/imagery/faculties/law/Women-speaking-on-a-podium-while-in-a-room-with-multiple-people-holding-a-mock-trial.jpg",
    },
    {
      alt: "A University of Canberra law student",
      src: "/content/dam/uc/imagery/faculties/law/bachelor-of-laws-undergrad.jpg",
    },
    {
      alt: "A law student working in a moot courtroom",
      src: "/content/dam/uc/imagery/faculties/law/legal-work-experience-wil.jpg",
    },
  ],
  "Politics & Society": [
    {
      alt: "Participants in a University of Canberra public-policy program",
      src: "/content/dam/uc/imagery/faculties/politics-economics-and-society/about-pathways-to-politics.jpg",
    },
    {
      alt: "A government student outside a civic building",
      src: "/content/dam/uc/imagery/faculties/politics-economics-and-society/bachelor-of-govtment-woman.jpg",
    },
    {
      alt: "A public-policy student working on a laptop",
      src: "/content/dam/uc/imagery/faculties/politics-economics-and-society/man-working-on-laptop-intern.jpg",
    },
    {
      alt: "University of Canberra students walking together on campus",
      src: "/content/dam/uc/imagery/faculties/politics-economics-and-society/two-people-walking-on-uc-campus.png.jpg",
    },
  ],
  Technology: [
    {
      alt: "Technology students collaborating on a drone project",
      src: "/content/dam/uc/imagery/faculties/technology/Two-stuednts-working-together-on-a-drone.jpg",
    },
    {
      alt: "Technology students working in a robotics laboratory",
      src: "/content/dam/uc/imagery/faculties/science/practical-experience-two-students.jpg",
    },
    {
      alt: "A University of Canberra cyber-security laboratory",
      src: "/content/dam/uc/imagery/faculties/technology/cyber-lab.jpg",
    },
    {
      alt: "A digital data visualisation",
      src: "/content/dam/uc/imagery/faculties/technology/data-science.jpg",
    },
  ],
};

const DEFAULT_UC_COURSE_MEDIA_POOL = UC_COURSE_MEDIA_BY_CATEGORY.Business;

const UC_COURSE_MEDIA_BY_SUBJECT: ReadonlyArray<readonly [RegExp, string]> = [
  [/built environment|building|construction|architecture/, "Built Environment"],
  [/digital marketing/, "Communication"],
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
  variantIndex = 0,
): UcCourseCardMedia {
  const subjectArea = course.subjectArea?.toLowerCase() ?? "";
  const subjectCategory = UC_COURSE_MEDIA_BY_SUBJECT.find(([matcher]) =>
    matcher.test(subjectArea),
  )?.[1];

  const matchingCategory =
    subjectCategory ??
    course.categories.find((category) => UC_COURSE_MEDIA_BY_CATEGORY[category]);
  const mediaPool = matchingCategory
    ? UC_COURSE_MEDIA_BY_CATEGORY[matchingCategory]
    : DEFAULT_UC_COURSE_MEDIA_POOL;
  const safeVariantIndex = Number.isFinite(variantIndex)
    ? Math.abs(Math.trunc(variantIndex))
    : 0;

  return mediaPool[safeVariantIndex % mediaPool.length];
}
