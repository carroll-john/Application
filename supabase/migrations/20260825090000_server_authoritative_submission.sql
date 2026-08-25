-- Make the database, rather than applicant-controlled JSON, authoritative for
-- course submission policy and the draft -> submitted transition.

create table if not exists public.course_submission_policies (
  catalog_id text not null,
  course_code text not null,
  course_title text not null,
  requires_english_proficiency boolean not null,
  english_proficiency_policy jsonb not null,
  section2_submission_policy jsonb not null,
  primary key (catalog_id, course_code),
  constraint course_submission_policies_catalog_id_check
    check (catalog_id in ('default', 'uc')),
  constraint course_submission_policies_english_policy_check
    check (jsonb_typeof(english_proficiency_policy) = 'array'),
  constraint course_submission_policies_section2_policy_check
    check (jsonb_typeof(section2_submission_policy) = 'object')
);

insert into public.course_submission_policies (
  catalog_id,
  course_code,
  course_title,
  requires_english_proficiency,
  english_proficiency_policy,
  section2_submission_policy
)
select
  policy ->> 'catalog_id',
  policy ->> 'course_code',
  policy ->> 'course_title',
  (policy ->> 'requires_english_proficiency')::boolean,
  policy -> 'english_proficiency_policy',
  policy -> 'section2_submission_policy'
from jsonb_array_elements(
  $course_submission_policies$
[
  {
    "catalog_id": "default",
    "course_code": "university-of-southern-queensland-unisq-master-of-business-administration-mba",
    "course_title": "Master of Business Administration (MBA)",
    "english_proficiency_policy": [
      {
        "params": {
          "acceptedPathways": [
            {
              "type": "english_test",
              "test": "IELTS",
              "minOverall": 6.5,
              "minBand": 6
            }
          ]
        }
      }
    ],
    "requires_english_proficiency": true,
    "section2_submission_policy": {
      "educationEvidenceLabel": "a bachelor degree or higher qualification",
      "minimumEducation": "Bachelor degree",
      "supportsExperienceAlternative": true,
      "supportsSecondaryQualification": false,
      "minimumEducationRank": 3,
      "schemaVersion": 1
    }
  },
  {
    "catalog_id": "default",
    "course_code": "mba-online",
    "course_title": "Master of Business Administration - (MBA) online",
    "english_proficiency_policy": [
      {
        "params": {
          "acceptedPathways": [
            {
              "type": "english_test",
              "test": "IELTS",
              "minOverall": 6.5,
              "minBand": null
            },
            {
              "type": "completion_in_country",
              "countries": [
                "AU",
                "NZ",
                "UK",
                "IE",
                "US",
                "CA",
                "ZA"
              ]
            }
          ]
        }
      }
    ],
    "requires_english_proficiency": true,
    "section2_submission_policy": {
      "educationEvidenceLabel": "a bachelor degree or higher qualification",
      "minimumEducation": "Bachelor degree",
      "supportsExperienceAlternative": false,
      "supportsSecondaryQualification": false,
      "minimumEducationRank": 3,
      "schemaVersion": 1
    }
  },
  {
    "catalog_id": "default",
    "course_code": "master-of-business-administration",
    "course_title": "Master of Business Administration",
    "english_proficiency_policy": [],
    "requires_english_proficiency": false,
    "section2_submission_policy": {
      "educationEvidenceLabel": "a bachelor degree or higher qualification",
      "minimumEducation": "Bachelor degree",
      "supportsExperienceAlternative": true,
      "supportsSecondaryQualification": false,
      "minimumEducationRank": 3,
      "schemaVersion": 1
    }
  },
  {
    "catalog_id": "default",
    "course_code": "master-of-business-administration-digital",
    "course_title": "Master of Business Administration (Digital)",
    "english_proficiency_policy": [],
    "requires_english_proficiency": false,
    "section2_submission_policy": {
      "educationEvidenceLabel": "a bachelor degree or higher qualification",
      "minimumEducation": "Bachelor degree",
      "supportsExperienceAlternative": true,
      "supportsSecondaryQualification": false,
      "minimumEducationRank": 3,
      "schemaVersion": 1
    }
  },
  {
    "catalog_id": "default",
    "course_code": "master-of-digital-health",
    "course_title": "Master of Digital Health",
    "english_proficiency_policy": [
      {
        "params": {
          "acceptedPathways": [
            {
              "type": "completion_in_country",
              "countries": [
                "AU",
                "NZ",
                "UK",
                "IE",
                "US",
                "CA",
                "ZA"
              ]
            }
          ]
        }
      }
    ],
    "requires_english_proficiency": true,
    "section2_submission_policy": {
      "educationEvidenceLabel": "a bachelor degree or higher qualification",
      "minimumEducation": "Bachelor degree",
      "supportsExperienceAlternative": false,
      "supportsSecondaryQualification": false,
      "minimumEducationRank": 3,
      "schemaVersion": 1
    }
  },
  {
    "catalog_id": "default",
    "course_code": "uts-online-university-of-technology-sydney-master-of-business-administration-mba",
    "course_title": "Master of Business Administration (MBA)",
    "english_proficiency_policy": [
      {
        "params": {
          "acceptedPathways": [
            {
              "type": "english_test",
              "test": "IELTS",
              "minOverall": 6.5,
              "minBand": 6
            }
          ]
        }
      },
      {
        "params": {
          "acceptedPathways": [
            {
              "type": "english_test",
              "test": "TOEFL_iBT",
              "minOverall": 79,
              "minBand": 21
            }
          ]
        }
      },
      {
        "params": {
          "acceptedPathways": [
            {
              "type": "english_test",
              "test": "PTE",
              "minOverall": 58,
              "minBand": 50
            }
          ]
        }
      }
    ],
    "requires_english_proficiency": true,
    "section2_submission_policy": {
      "educationEvidenceLabel": "a master's degree or higher qualification",
      "minimumEducation": "Masters degree",
      "supportsExperienceAlternative": true,
      "supportsSecondaryQualification": false,
      "minimumEducationRank": 5,
      "schemaVersion": 1
    }
  },
  {
    "catalog_id": "default",
    "course_code": "master-of-business-management-with-discipline-studies-in-public-health",
    "course_title": "Master of Business Management with discipline studies in Public Health",
    "english_proficiency_policy": [
      {
        "params": {
          "acceptedPathways": [
            {
              "type": "completion_in_country",
              "countries": [
                "AU",
                "NZ",
                "UK",
                "IE",
                "US",
                "CA",
                "ZA"
              ]
            }
          ]
        }
      }
    ],
    "requires_english_proficiency": true,
    "section2_submission_policy": {
      "educationEvidenceLabel": "a bachelor degree or higher qualification",
      "minimumEducation": "Bachelor degree",
      "supportsExperienceAlternative": true,
      "supportsSecondaryQualification": false,
      "minimumEducationRank": 3,
      "schemaVersion": 1
    }
  },
  {
    "catalog_id": "default",
    "course_code": "master-of-health-management",
    "course_title": "Master of Health Management",
    "english_proficiency_policy": [
      {
        "params": {
          "acceptedPathways": [
            {
              "type": "completion_in_country",
              "countries": [
                "AU",
                "NZ",
                "UK",
                "IE",
                "US",
                "CA",
                "ZA"
              ]
            },
            {
              "type": "english_test",
              "test": "IELTS",
              "minOverall": 6.5,
              "minBand": 6
            }
          ]
        }
      }
    ],
    "requires_english_proficiency": true,
    "section2_submission_policy": {
      "educationEvidenceLabel": "a bachelor degree or higher qualification",
      "minimumEducation": "Bachelor degree",
      "supportsExperienceAlternative": true,
      "supportsSecondaryQualification": false,
      "minimumEducationRank": 3,
      "schemaVersion": 1
    }
  },
  {
    "catalog_id": "default",
    "course_code": "graduate-certificate-in-digital-health-management",
    "course_title": "Graduate Certificate in Digital Health Management",
    "english_proficiency_policy": [],
    "requires_english_proficiency": false,
    "section2_submission_policy": {
      "educationEvidenceLabel": "a bachelor degree or higher qualification",
      "minimumEducation": "Bachelor degree",
      "supportsExperienceAlternative": true,
      "supportsSecondaryQualification": false,
      "minimumEducationRank": 3,
      "schemaVersion": 1
    }
  },
  {
    "catalog_id": "default",
    "course_code": "la-trobe-university-master-of-information-technology",
    "course_title": "Master of Information Technology",
    "english_proficiency_policy": [
      {
        "params": {
          "acceptedPathways": [
            {
              "type": "completion_in_country",
              "countries": [
                "AU",
                "NZ",
                "UK",
                "IE",
                "US",
                "CA",
                "ZA"
              ]
            }
          ]
        }
      }
    ],
    "requires_english_proficiency": true,
    "section2_submission_policy": {
      "educationEvidenceLabel": "a bachelor degree or higher qualification",
      "minimumEducation": "Bachelor degree",
      "supportsExperienceAlternative": false,
      "supportsSecondaryQualification": false,
      "minimumEducationRank": 3,
      "schemaVersion": 1
    }
  },
  {
    "catalog_id": "default",
    "course_code": "master-of-health-management-and-policy-global",
    "course_title": "Master of Health Management and Policy (Global)",
    "english_proficiency_policy": [
      {
        "params": {
          "acceptedPathways": [
            {
              "type": "english_test",
              "test": "IELTS",
              "minOverall": 6.5,
              "minBand": 6
            }
          ]
        }
      }
    ],
    "requires_english_proficiency": true,
    "section2_submission_policy": {
      "educationEvidenceLabel": "a bachelor degree or higher qualification",
      "minimumEducation": "Bachelor degree",
      "supportsExperienceAlternative": false,
      "supportsSecondaryQualification": false,
      "minimumEducationRank": 3,
      "schemaVersion": 1
    }
  },
  {
    "catalog_id": "default",
    "course_code": "university-of-southern-queensland-unisq-master-of-information-technology",
    "course_title": "Master of Information Technology",
    "english_proficiency_policy": [
      {
        "params": {
          "acceptedPathways": [
            {
              "type": "english_test",
              "test": "IELTS",
              "minOverall": 6,
              "minBand": 5.5
            },
            {
              "type": "completion_in_country",
              "countries": [
                "AU",
                "NZ",
                "UK",
                "IE",
                "US",
                "CA",
                "ZA"
              ]
            }
          ]
        }
      }
    ],
    "requires_english_proficiency": true,
    "section2_submission_policy": {
      "educationEvidenceLabel": "a bachelor degree or higher qualification",
      "minimumEducation": "Bachelor degree",
      "supportsExperienceAlternative": true,
      "supportsSecondaryQualification": false,
      "minimumEducationRank": 3,
      "schemaVersion": 1
    }
  },
  {
    "catalog_id": "default",
    "course_code": "master-of-information-technology-mit",
    "course_title": "Master of Information Technology (MIT)",
    "english_proficiency_policy": [
      {
        "params": {
          "acceptedPathways": [
            {
              "type": "english_test",
              "test": "IELTS",
              "minOverall": 6.5,
              "minBand": 6
            }
          ]
        }
      }
    ],
    "requires_english_proficiency": true,
    "section2_submission_policy": {
      "educationEvidenceLabel": "a bachelor degree or higher qualification",
      "minimumEducation": "Bachelor degree",
      "supportsExperienceAlternative": false,
      "supportsSecondaryQualification": false,
      "minimumEducationRank": 3,
      "schemaVersion": 1
    }
  },
  {
    "catalog_id": "default",
    "course_code": "cquniversity-australia-master-of-information-technology",
    "course_title": "Master of Information Technology",
    "english_proficiency_policy": [],
    "requires_english_proficiency": false,
    "section2_submission_policy": {
      "educationEvidenceLabel": "a bachelor degree or higher qualification",
      "minimumEducation": "Bachelor degree",
      "supportsExperienceAlternative": true,
      "supportsSecondaryQualification": false,
      "minimumEducationRank": 3,
      "schemaVersion": 1
    }
  },
  {
    "catalog_id": "default",
    "course_code": "southern-cross-university-master-of-information-technology",
    "course_title": "Master of Information Technology",
    "english_proficiency_policy": [
      {
        "params": {
          "acceptedPathways": [
            {
              "type": "english_test",
              "test": "IELTS",
              "minOverall": 6.5,
              "minBand": 6
            }
          ]
        }
      }
    ],
    "requires_english_proficiency": true,
    "section2_submission_policy": {
      "educationEvidenceLabel": "a bachelor degree or higher qualification",
      "minimumEducation": "Bachelor degree",
      "supportsExperienceAlternative": false,
      "supportsSecondaryQualification": false,
      "minimumEducationRank": 3,
      "schemaVersion": 1
    }
  },
  {
    "catalog_id": "default",
    "course_code": "unsw-online-university-of-new-south-wales-master-of-data-science",
    "course_title": "Master of Data Science",
    "english_proficiency_policy": [
      {
        "params": {
          "acceptedPathways": [
            {
              "type": "english_test",
              "test": "IELTS",
              "minOverall": 6.5,
              "minBand": null
            },
            {
              "type": "completion_in_country",
              "countries": [
                "AU",
                "NZ",
                "UK",
                "IE",
                "US",
                "CA",
                "ZA"
              ]
            }
          ]
        }
      }
    ],
    "requires_english_proficiency": true,
    "section2_submission_policy": {
      "educationEvidenceLabel": "a bachelor degree or higher qualification",
      "minimumEducation": "Bachelor degree",
      "supportsExperienceAlternative": false,
      "supportsSecondaryQualification": false,
      "minimumEducationRank": 3,
      "schemaVersion": 1
    }
  },
  {
    "catalog_id": "default",
    "course_code": "university-of-southern-queensland-unisq-master-of-data-science",
    "course_title": "Master of Data Science",
    "english_proficiency_policy": [
      {
        "params": {
          "acceptedPathways": [
            {
              "type": "english_test",
              "test": "IELTS",
              "minOverall": 6,
              "minBand": 5.5
            }
          ]
        }
      }
    ],
    "requires_english_proficiency": true,
    "section2_submission_policy": {
      "educationEvidenceLabel": "a bachelor degree or higher qualification",
      "minimumEducation": "Bachelor degree",
      "supportsExperienceAlternative": true,
      "supportsSecondaryQualification": false,
      "minimumEducationRank": 3,
      "schemaVersion": 1
    }
  },
  {
    "catalog_id": "default",
    "course_code": "master-of-data-analytics-online",
    "course_title": "Master of Data Analytics (Online)",
    "english_proficiency_policy": [],
    "requires_english_proficiency": false,
    "section2_submission_policy": {
      "educationEvidenceLabel": "a bachelor degree or higher qualification",
      "minimumEducation": "Bachelor degree",
      "supportsExperienceAlternative": false,
      "supportsSecondaryQualification": false,
      "minimumEducationRank": 3,
      "schemaVersion": 1
    }
  },
  {
    "catalog_id": "default",
    "course_code": "deakin-university-master-of-data-science",
    "course_title": "Master of Data Science",
    "english_proficiency_policy": [],
    "requires_english_proficiency": false,
    "section2_submission_policy": {
      "educationEvidenceLabel": "a bachelor degree or higher qualification",
      "minimumEducation": "Bachelor degree",
      "supportsExperienceAlternative": true,
      "supportsSecondaryQualification": false,
      "minimumEducationRank": 3,
      "schemaVersion": 1
    }
  },
  {
    "catalog_id": "default",
    "course_code": "la-trobe-university-master-of-data-science",
    "course_title": "Master of Data Science",
    "english_proficiency_policy": [],
    "requires_english_proficiency": false,
    "section2_submission_policy": {
      "educationEvidenceLabel": "a bachelor degree or higher qualification",
      "minimumEducation": "Bachelor degree",
      "supportsExperienceAlternative": false,
      "supportsSecondaryQualification": false,
      "minimumEducationRank": 3,
      "schemaVersion": 1
    }
  },
  {
    "catalog_id": "default",
    "course_code": "graduate-certificate-in-digital-health",
    "course_title": "Graduate Certificate in Digital Health",
    "english_proficiency_policy": [
      {
        "params": {
          "acceptedPathways": [
            {
              "type": "completion_in_country",
              "countries": [
                "AU",
                "NZ",
                "UK",
                "IE",
                "US",
                "CA",
                "ZA"
              ]
            }
          ]
        }
      }
    ],
    "requires_english_proficiency": true,
    "section2_submission_policy": {
      "educationEvidenceLabel": "a bachelor degree or higher qualification",
      "minimumEducation": "Bachelor degree",
      "supportsExperienceAlternative": true,
      "supportsSecondaryQualification": false,
      "minimumEducationRank": 3,
      "schemaVersion": 1
    }
  },
  {
    "catalog_id": "default",
    "course_code": "master-of-clinical-nursing-acu-online",
    "course_title": "Master of Clinical Nursing (ACU Online)",
    "english_proficiency_policy": [],
    "requires_english_proficiency": false,
    "section2_submission_policy": {
      "educationEvidenceLabel": "a bachelor degree or higher qualification",
      "minimumEducation": "Bachelor degree",
      "supportsExperienceAlternative": false,
      "supportsSecondaryQualification": false,
      "minimumEducationRank": 3,
      "schemaVersion": 1
    }
  },
  {
    "catalog_id": "default",
    "course_code": "university-of-melbourne-master-of-public-health",
    "course_title": "Master of Public Health",
    "english_proficiency_policy": [
      {
        "params": {
          "acceptedPathways": [
            {
              "type": "english_test",
              "test": "IELTS",
              "minOverall": 6.5,
              "minBand": 6
            }
          ]
        }
      },
      {
        "params": {
          "acceptedPathways": [
            {
              "type": "english_test",
              "test": "TOEFL_iBT",
              "minOverall": 81,
              "minBand": 16
            }
          ]
        }
      },
      {
        "params": {
          "acceptedPathways": [
            {
              "type": "english_test",
              "test": "PTE",
              "minOverall": 64,
              "minBand": 60
            }
          ]
        }
      },
      {
        "params": {
          "acceptedPathways": [
            {
              "type": "english_test",
              "test": "CAE",
              "minOverall": 169,
              "minBand": null
            }
          ]
        }
      }
    ],
    "requires_english_proficiency": true,
    "section2_submission_policy": {
      "educationEvidenceLabel": "a master's degree or higher qualification",
      "minimumEducation": "Masters degree",
      "supportsExperienceAlternative": true,
      "supportsSecondaryQualification": false,
      "minimumEducationRank": 5,
      "schemaVersion": 1
    }
  },
  {
    "catalog_id": "default",
    "course_code": "monash-university-monash-online-master-of-public-health",
    "course_title": "Master of Public Health",
    "english_proficiency_policy": [
      {
        "params": {
          "acceptedPathways": [
            {
              "type": "completion_in_country",
              "countries": [
                "AU",
                "NZ",
                "UK",
                "IE",
                "US",
                "CA",
                "ZA"
              ]
            }
          ]
        }
      }
    ],
    "requires_english_proficiency": true,
    "section2_submission_policy": {
      "educationEvidenceLabel": "a bachelor degree or higher qualification",
      "minimumEducation": "Bachelor degree",
      "supportsExperienceAlternative": true,
      "supportsSecondaryQualification": false,
      "minimumEducationRank": 3,
      "schemaVersion": 1
    }
  },
  {
    "catalog_id": "default",
    "course_code": "master-of-business-management-with-discipline-studies-in-project-management",
    "course_title": "Master of Business Management with discipline studies in Project Management",
    "english_proficiency_policy": [
      {
        "params": {
          "acceptedPathways": [
            {
              "type": "completion_in_country",
              "countries": [
                "AU",
                "NZ",
                "UK",
                "IE",
                "US",
                "CA",
                "ZA"
              ]
            }
          ]
        }
      }
    ],
    "requires_english_proficiency": true,
    "section2_submission_policy": {
      "educationEvidenceLabel": "a bachelor degree or higher qualification",
      "minimumEducation": "Bachelor degree",
      "supportsExperienceAlternative": true,
      "supportsSecondaryQualification": false,
      "minimumEducationRank": 3,
      "schemaVersion": 1
    }
  },
  {
    "catalog_id": "default",
    "course_code": "uts-online-university-of-technology-sydney-master-of-public-health",
    "course_title": "Master of Public Health",
    "english_proficiency_policy": [
      {
        "params": {
          "acceptedPathways": [
            {
              "type": "english_test",
              "test": "IELTS",
              "minOverall": 6.5,
              "minBand": 6
            }
          ]
        }
      },
      {
        "params": {
          "acceptedPathways": [
            {
              "type": "english_test",
              "test": "TOEFL_iBT",
              "minOverall": 79,
              "minBand": 21
            }
          ]
        }
      },
      {
        "params": {
          "acceptedPathways": [
            {
              "type": "english_test",
              "test": "TOEFL_iBT",
              "minOverall": 550,
              "minBand": 4.5
            }
          ]
        }
      },
      {
        "params": {
          "acceptedPathways": [
            {
              "type": "english_test",
              "test": "PTE",
              "minOverall": 58,
              "minBand": 50
            }
          ]
        }
      },
      {
        "params": {
          "acceptedPathways": [
            {
              "type": "english_test",
              "test": "CAE",
              "minOverall": 176,
              "minBand": 169
            }
          ]
        }
      }
    ],
    "requires_english_proficiency": true,
    "section2_submission_policy": {
      "educationEvidenceLabel": "a bachelor degree or higher qualification",
      "minimumEducation": "Bachelor degree",
      "supportsExperienceAlternative": false,
      "supportsSecondaryQualification": false,
      "minimumEducationRank": 3,
      "schemaVersion": 1
    }
  },
  {
    "catalog_id": "default",
    "course_code": "graduate-certificate-in-public-health",
    "course_title": "Graduate Certificate in Public Health",
    "english_proficiency_policy": [],
    "requires_english_proficiency": false,
    "section2_submission_policy": {
      "educationEvidenceLabel": "a bachelor degree or higher qualification",
      "minimumEducation": "Bachelor degree",
      "supportsExperienceAlternative": true,
      "supportsSecondaryQualification": false,
      "minimumEducationRank": 3,
      "schemaVersion": 1
    }
  },
  {
    "catalog_id": "default",
    "course_code": "master-of-cybersecurity",
    "course_title": "Master of Cybersecurity",
    "english_proficiency_policy": [],
    "requires_english_proficiency": false,
    "section2_submission_policy": {
      "educationEvidenceLabel": "a bachelor degree or higher qualification",
      "minimumEducation": "Bachelor degree",
      "supportsExperienceAlternative": false,
      "supportsSecondaryQualification": false,
      "minimumEducationRank": 3,
      "schemaVersion": 1
    }
  },
  {
    "catalog_id": "default",
    "course_code": "deakin-university-master-of-cyber-security",
    "course_title": "Master of Cyber Security",
    "english_proficiency_policy": [],
    "requires_english_proficiency": false,
    "section2_submission_policy": {
      "educationEvidenceLabel": "a bachelor degree or higher qualification",
      "minimumEducation": "Bachelor degree",
      "supportsExperienceAlternative": true,
      "supportsSecondaryQualification": false,
      "minimumEducationRank": 3,
      "schemaVersion": 1
    }
  },
  {
    "catalog_id": "default",
    "course_code": "charles-sturt-university-in-partnership-with-it-masters-master-of-cyber-security",
    "course_title": "Master of Cyber Security",
    "english_proficiency_policy": [
      {
        "params": {
          "acceptedPathways": [
            {
              "type": "completion_in_country",
              "countries": [
                "AU",
                "NZ",
                "UK",
                "IE",
                "US",
                "CA",
                "ZA"
              ]
            }
          ]
        }
      }
    ],
    "requires_english_proficiency": true,
    "section2_submission_policy": {
      "educationEvidenceLabel": "a bachelor degree or higher qualification",
      "minimumEducation": "Bachelor degree",
      "supportsExperienceAlternative": false,
      "supportsSecondaryQualification": false,
      "minimumEducationRank": 3,
      "schemaVersion": 1
    }
  },
  {
    "catalog_id": "default",
    "course_code": "monash-online-monash-university-master-of-human-resource-management",
    "course_title": "Master of Human Resource Management",
    "english_proficiency_policy": [
      {
        "params": {
          "acceptedPathways": [
            {
              "type": "completion_in_country",
              "countries": [
                "AU",
                "NZ",
                "UK",
                "IE",
                "US",
                "CA",
                "ZA"
              ]
            }
          ]
        }
      }
    ],
    "requires_english_proficiency": true,
    "section2_submission_policy": {
      "educationEvidenceLabel": "a bachelor degree or higher qualification",
      "minimumEducation": "Bachelor degree",
      "supportsExperienceAlternative": true,
      "supportsSecondaryQualification": false,
      "minimumEducationRank": 3,
      "schemaVersion": 1
    }
  },
  {
    "catalog_id": "default",
    "course_code": "master-of-human-resource-management-with-specialisations",
    "course_title": "Master of Human Resource Management (with specialisations)",
    "english_proficiency_policy": [
      {
        "params": {
          "acceptedPathways": [
            {
              "type": "completion_in_country",
              "countries": [
                "AU",
                "NZ",
                "UK",
                "IE",
                "US",
                "CA",
                "ZA"
              ]
            }
          ]
        }
      }
    ],
    "requires_english_proficiency": true,
    "section2_submission_policy": {
      "educationEvidenceLabel": "a bachelor degree or higher qualification",
      "minimumEducation": "Bachelor degree",
      "supportsExperienceAlternative": false,
      "supportsSecondaryQualification": false,
      "minimumEducationRank": 3,
      "schemaVersion": 1
    }
  },
  {
    "catalog_id": "default",
    "course_code": "deakin-university-master-of-human-resource-management",
    "course_title": "Master of Human Resource Management",
    "english_proficiency_policy": [
      {
        "params": {
          "acceptedPathways": [
            {
              "type": "english_test",
              "test": "IELTS",
              "minOverall": 6.5,
              "minBand": 6
            }
          ]
        }
      }
    ],
    "requires_english_proficiency": true,
    "section2_submission_policy": {
      "educationEvidenceLabel": "a bachelor degree or higher qualification",
      "minimumEducation": "Bachelor degree",
      "supportsExperienceAlternative": true,
      "supportsSecondaryQualification": false,
      "minimumEducationRank": 3,
      "schemaVersion": 1
    }
  },
  {
    "catalog_id": "default",
    "course_code": "master-of-business-marketing",
    "course_title": "Master of Business (Marketing)",
    "english_proficiency_policy": [
      {
        "params": {
          "acceptedPathways": [
            {
              "type": "english_test",
              "test": "IELTS",
              "minOverall": 6.5,
              "minBand": 6
            },
            {
              "type": "completion_in_country",
              "countries": [
                "AU",
                "NZ",
                "UK",
                "IE",
                "US",
                "CA",
                "ZA"
              ]
            }
          ]
        }
      }
    ],
    "requires_english_proficiency": true,
    "section2_submission_policy": {
      "educationEvidenceLabel": "a bachelor degree or higher qualification",
      "minimumEducation": "Bachelor degree",
      "supportsExperienceAlternative": true,
      "supportsSecondaryQualification": false,
      "minimumEducationRank": 3,
      "schemaVersion": 1
    }
  },
  {
    "catalog_id": "uc",
    "course_code": "master-of-business-administration",
    "course_title": "Master of Business Administration",
    "english_proficiency_policy": [],
    "requires_english_proficiency": false,
    "section2_submission_policy": {
      "educationEvidenceLabel": "a bachelor degree or higher qualification",
      "minimumEducation": "Bachelor degree",
      "supportsExperienceAlternative": true,
      "supportsSecondaryQualification": false,
      "minimumEducationRank": 3,
      "schemaVersion": 1
    }
  },
  {
    "catalog_id": "uc",
    "course_code": "master-of-business-administration-government",
    "course_title": "Master of Business Administration (Government)",
    "english_proficiency_policy": [
      {
        "params": {
          "acceptedPathways": [
            {
              "type": "english_test",
              "test": "IELTS",
              "minOverall": 6.5,
              "minBand": 6
            },
            {
              "type": "completion_in_country",
              "countries": [
                "AU",
                "NZ",
                "UK",
                "IE",
                "US",
                "CA",
                "ZA"
              ]
            }
          ]
        }
      }
    ],
    "requires_english_proficiency": true,
    "section2_submission_policy": {
      "educationEvidenceLabel": "a bachelor degree or higher qualification",
      "minimumEducation": "Bachelor degree",
      "supportsExperienceAlternative": true,
      "supportsSecondaryQualification": false,
      "minimumEducationRank": 3,
      "schemaVersion": 1
    }
  },
  {
    "catalog_id": "uc",
    "course_code": "graduate-certificate-in-business",
    "course_title": "Graduate Certificate in Business",
    "english_proficiency_policy": [],
    "requires_english_proficiency": false,
    "section2_submission_policy": {
      "educationEvidenceLabel": "a bachelor degree or higher qualification",
      "minimumEducation": "Bachelor degree",
      "supportsExperienceAlternative": true,
      "supportsSecondaryQualification": false,
      "minimumEducationRank": 3,
      "schemaVersion": 1
    }
  },
  {
    "catalog_id": "uc",
    "course_code": "graduate-certificate-in-business-administration-government",
    "course_title": "Graduate Certificate in Business Administration (Government)",
    "english_proficiency_policy": [],
    "requires_english_proficiency": false,
    "section2_submission_policy": {
      "educationEvidenceLabel": "a bachelor degree or higher qualification",
      "minimumEducation": "Bachelor degree",
      "supportsExperienceAlternative": true,
      "supportsSecondaryQualification": false,
      "minimumEducationRank": 3,
      "schemaVersion": 1
    }
  },
  {
    "catalog_id": "uc",
    "course_code": "master-of-communication",
    "course_title": "Master of Communication",
    "english_proficiency_policy": [],
    "requires_english_proficiency": false,
    "section2_submission_policy": {
      "educationEvidenceLabel": "a bachelor degree or higher qualification",
      "minimumEducation": "Bachelor degree",
      "supportsExperienceAlternative": true,
      "supportsSecondaryQualification": false,
      "minimumEducationRank": 3,
      "schemaVersion": 1
    }
  },
  {
    "catalog_id": "uc",
    "course_code": "graduate-diploma-in-communication",
    "course_title": "Graduate Diploma in Communication",
    "english_proficiency_policy": [],
    "requires_english_proficiency": false,
    "section2_submission_policy": {
      "educationEvidenceLabel": "a bachelor degree or higher qualification",
      "minimumEducation": "Bachelor degree",
      "supportsExperienceAlternative": true,
      "supportsSecondaryQualification": false,
      "minimumEducationRank": 3,
      "schemaVersion": 1
    }
  },
  {
    "catalog_id": "uc",
    "course_code": "graduate-certificate-in-communication",
    "course_title": "Graduate Certificate in Communication",
    "english_proficiency_policy": [],
    "requires_english_proficiency": false,
    "section2_submission_policy": {
      "educationEvidenceLabel": "a bachelor degree or higher qualification",
      "minimumEducation": "Bachelor degree",
      "supportsExperienceAlternative": true,
      "supportsSecondaryQualification": false,
      "minimumEducationRank": 3,
      "schemaVersion": 1
    }
  },
  {
    "catalog_id": "uc",
    "course_code": "graduate-certificate-in-digital-marketing",
    "course_title": "Graduate Certificate in Digital Marketing",
    "english_proficiency_policy": [],
    "requires_english_proficiency": false,
    "section2_submission_policy": {
      "educationEvidenceLabel": "a bachelor degree or higher qualification",
      "minimumEducation": "Bachelor degree",
      "supportsExperienceAlternative": true,
      "supportsSecondaryQualification": false,
      "minimumEducationRank": 3,
      "schemaVersion": 1
    }
  },
  {
    "catalog_id": "uc",
    "course_code": "graduate-certificate-in-building-and-construction-information-management",
    "course_title": "Graduate Certificate in Building and Construction Information Management",
    "english_proficiency_policy": [],
    "requires_english_proficiency": false,
    "section2_submission_policy": {
      "educationEvidenceLabel": "a bachelor degree or higher qualification",
      "minimumEducation": "Bachelor degree",
      "supportsExperienceAlternative": true,
      "supportsSecondaryQualification": false,
      "minimumEducationRank": 3,
      "schemaVersion": 1
    }
  },
  {
    "catalog_id": "uc",
    "course_code": "graduate-certificate-in-counselling",
    "course_title": "Graduate Certificate in Counselling",
    "english_proficiency_policy": [],
    "requires_english_proficiency": false,
    "section2_submission_policy": {
      "educationEvidenceLabel": "a bachelor degree or higher qualification",
      "minimumEducation": "Bachelor degree",
      "supportsExperienceAlternative": true,
      "supportsSecondaryQualification": false,
      "minimumEducationRank": 3,
      "schemaVersion": 1
    }
  },
  {
    "catalog_id": "uc",
    "course_code": "graduate-diploma-in-counselling",
    "course_title": "Graduate Diploma in Counselling",
    "english_proficiency_policy": [],
    "requires_english_proficiency": false,
    "section2_submission_policy": {
      "educationEvidenceLabel": "a bachelor degree or higher qualification",
      "minimumEducation": "Bachelor degree",
      "supportsExperienceAlternative": true,
      "supportsSecondaryQualification": false,
      "minimumEducationRank": 3,
      "schemaVersion": 1
    }
  },
  {
    "catalog_id": "uc",
    "course_code": "master-of-counselling",
    "course_title": "Master of Counselling",
    "english_proficiency_policy": [],
    "requires_english_proficiency": false,
    "section2_submission_policy": {
      "educationEvidenceLabel": "a bachelor degree or higher qualification",
      "minimumEducation": "Bachelor degree",
      "supportsExperienceAlternative": true,
      "supportsSecondaryQualification": false,
      "minimumEducationRank": 3,
      "schemaVersion": 1
    }
  },
  {
    "catalog_id": "uc",
    "course_code": "master-of-social-work-qualifying",
    "course_title": "Master of Social Work (Qualifying)",
    "english_proficiency_policy": [],
    "requires_english_proficiency": false,
    "section2_submission_policy": {
      "educationEvidenceLabel": "a bachelor degree or higher qualification",
      "minimumEducation": "Bachelor degree",
      "supportsExperienceAlternative": true,
      "supportsSecondaryQualification": false,
      "minimumEducationRank": 3,
      "schemaVersion": 1
    }
  },
  {
    "catalog_id": "uc",
    "course_code": "graduate-certificate-in-law",
    "course_title": "Graduate Certificate in Law",
    "english_proficiency_policy": [],
    "requires_english_proficiency": false,
    "section2_submission_policy": {
      "educationEvidenceLabel": "a bachelor degree or higher qualification",
      "minimumEducation": "Bachelor degree",
      "supportsExperienceAlternative": true,
      "supportsSecondaryQualification": false,
      "minimumEducationRank": 3,
      "schemaVersion": 1
    }
  },
  {
    "catalog_id": "uc",
    "course_code": "graduate-diploma-in-law",
    "course_title": "Graduate Diploma in Law",
    "english_proficiency_policy": [],
    "requires_english_proficiency": false,
    "section2_submission_policy": {
      "educationEvidenceLabel": "a bachelor degree or higher qualification",
      "minimumEducation": "Bachelor degree",
      "supportsExperienceAlternative": true,
      "supportsSecondaryQualification": false,
      "minimumEducationRank": 3,
      "schemaVersion": 1
    }
  },
  {
    "catalog_id": "uc",
    "course_code": "juris-doctor",
    "course_title": "Juris Doctor",
    "english_proficiency_policy": [],
    "requires_english_proficiency": false,
    "section2_submission_policy": {
      "educationEvidenceLabel": "a bachelor degree or higher qualification",
      "minimumEducation": "Bachelor degree",
      "supportsExperienceAlternative": true,
      "supportsSecondaryQualification": false,
      "minimumEducationRank": 3,
      "schemaVersion": 1
    }
  },
  {
    "catalog_id": "uc",
    "course_code": "graduate-certificate-in-public-policy",
    "course_title": "Graduate Certificate in Public Policy",
    "english_proficiency_policy": [],
    "requires_english_proficiency": false,
    "section2_submission_policy": {
      "educationEvidenceLabel": "a bachelor degree or higher qualification",
      "minimumEducation": "Bachelor degree",
      "supportsExperienceAlternative": true,
      "supportsSecondaryQualification": false,
      "minimumEducationRank": 3,
      "schemaVersion": 1
    }
  },
  {
    "catalog_id": "uc",
    "course_code": "graduate-certificate-in-policy-evaluation",
    "course_title": "Graduate Certificate in Policy Evaluation",
    "english_proficiency_policy": [],
    "requires_english_proficiency": false,
    "section2_submission_policy": {
      "educationEvidenceLabel": "a bachelor degree or higher qualification",
      "minimumEducation": "Bachelor degree",
      "supportsExperienceAlternative": true,
      "supportsSecondaryQualification": false,
      "minimumEducationRank": 3,
      "schemaVersion": 1
    }
  },
  {
    "catalog_id": "uc",
    "course_code": "graduate-certificate-in-gender-policy",
    "course_title": "Graduate Certificate in Gender Policy",
    "english_proficiency_policy": [],
    "requires_english_proficiency": false,
    "section2_submission_policy": {
      "educationEvidenceLabel": "a bachelor degree or higher qualification",
      "minimumEducation": "Bachelor degree",
      "supportsExperienceAlternative": true,
      "supportsSecondaryQualification": false,
      "minimumEducationRank": 3,
      "schemaVersion": 1
    }
  },
  {
    "catalog_id": "uc",
    "course_code": "graduate-certificate-in-lgbtqia-policy",
    "course_title": "Graduate Certificate in LGBTQIA+ Policy",
    "english_proficiency_policy": [],
    "requires_english_proficiency": false,
    "section2_submission_policy": {
      "educationEvidenceLabel": "a bachelor degree or higher qualification",
      "minimumEducation": "Bachelor degree",
      "supportsExperienceAlternative": true,
      "supportsSecondaryQualification": false,
      "minimumEducationRank": 3,
      "schemaVersion": 1
    }
  },
  {
    "catalog_id": "uc",
    "course_code": "graduate-diploma-in-public-policy",
    "course_title": "Graduate Diploma in Public Policy",
    "english_proficiency_policy": [],
    "requires_english_proficiency": false,
    "section2_submission_policy": {
      "educationEvidenceLabel": "a bachelor degree or higher qualification",
      "minimumEducation": "Bachelor degree",
      "supportsExperienceAlternative": true,
      "supportsSecondaryQualification": false,
      "minimumEducationRank": 3,
      "schemaVersion": 1
    }
  },
  {
    "catalog_id": "uc",
    "course_code": "master-of-public-policy",
    "course_title": "Master of Public Policy",
    "english_proficiency_policy": [],
    "requires_english_proficiency": false,
    "section2_submission_policy": {
      "educationEvidenceLabel": "a bachelor degree or higher qualification",
      "minimumEducation": "Bachelor degree",
      "supportsExperienceAlternative": true,
      "supportsSecondaryQualification": false,
      "minimumEducationRank": 3,
      "schemaVersion": 1
    }
  },
  {
    "catalog_id": "uc",
    "course_code": "graduate-certificate-in-cyber-security",
    "course_title": "Graduate Certificate in Cyber Security",
    "english_proficiency_policy": [],
    "requires_english_proficiency": false,
    "section2_submission_policy": {
      "educationEvidenceLabel": "a bachelor degree or higher qualification",
      "minimumEducation": "Bachelor degree",
      "supportsExperienceAlternative": true,
      "supportsSecondaryQualification": false,
      "minimumEducationRank": 3,
      "schemaVersion": 1
    }
  },
  {
    "catalog_id": "uc",
    "course_code": "graduate-certificate-in-data-science",
    "course_title": "Graduate Certificate in Data Science",
    "english_proficiency_policy": [],
    "requires_english_proficiency": false,
    "section2_submission_policy": {
      "educationEvidenceLabel": "a bachelor degree or higher qualification",
      "minimumEducation": "Bachelor degree",
      "supportsExperienceAlternative": true,
      "supportsSecondaryQualification": false,
      "minimumEducationRank": 3,
      "schemaVersion": 1
    }
  },
  {
    "catalog_id": "uc",
    "course_code": "graduate-certificate-in-education",
    "course_title": "Graduate Certificate in Education",
    "english_proficiency_policy": [],
    "requires_english_proficiency": false,
    "section2_submission_policy": {
      "educationEvidenceLabel": "a bachelor degree or higher qualification",
      "minimumEducation": "Bachelor degree",
      "supportsExperienceAlternative": true,
      "supportsSecondaryQualification": false,
      "minimumEducationRank": 3,
      "schemaVersion": 1
    }
  },
  {
    "catalog_id": "uc",
    "course_code": "graduate-certificate-in-stem-education",
    "course_title": "Graduate Certificate in STEM Education",
    "english_proficiency_policy": [],
    "requires_english_proficiency": false,
    "section2_submission_policy": {
      "educationEvidenceLabel": "a bachelor degree or higher qualification",
      "minimumEducation": "Bachelor degree",
      "supportsExperienceAlternative": true,
      "supportsSecondaryQualification": false,
      "minimumEducationRank": 3,
      "schemaVersion": 1
    }
  },
  {
    "catalog_id": "uc",
    "course_code": "graduate-certificate-in-educational-leadership",
    "course_title": "Graduate Certificate in Educational Leadership",
    "english_proficiency_policy": [],
    "requires_english_proficiency": false,
    "section2_submission_policy": {
      "educationEvidenceLabel": "a bachelor degree or higher qualification",
      "minimumEducation": "Bachelor degree",
      "supportsExperienceAlternative": true,
      "supportsSecondaryQualification": false,
      "minimumEducationRank": 3,
      "schemaVersion": 1
    }
  },
  {
    "catalog_id": "uc",
    "course_code": "master-of-teaching-primary-or-secondary",
    "course_title": "Master of Teaching (Primary or Secondary)",
    "english_proficiency_policy": [],
    "requires_english_proficiency": false,
    "section2_submission_policy": {
      "educationEvidenceLabel": "a bachelor degree or higher qualification",
      "minimumEducation": "Bachelor degree",
      "supportsExperienceAlternative": true,
      "supportsSecondaryQualification": false,
      "minimumEducationRank": 3,
      "schemaVersion": 1
    }
  },
  {
    "catalog_id": "uc",
    "course_code": "master-of-education",
    "course_title": "Master of Education",
    "english_proficiency_policy": [],
    "requires_english_proficiency": false,
    "section2_submission_policy": {
      "educationEvidenceLabel": "a bachelor degree or higher qualification",
      "minimumEducation": "Bachelor degree",
      "supportsExperienceAlternative": true,
      "supportsSecondaryQualification": false,
      "minimumEducationRank": 3,
      "schemaVersion": 1
    }
  },
  {
    "catalog_id": "uc",
    "course_code": "master-of-education-stem",
    "course_title": "Master of Education (STEM)",
    "english_proficiency_policy": [],
    "requires_english_proficiency": false,
    "section2_submission_policy": {
      "educationEvidenceLabel": "a bachelor degree or higher qualification",
      "minimumEducation": "Bachelor degree",
      "supportsExperienceAlternative": true,
      "supportsSecondaryQualification": false,
      "minimumEducationRank": 3,
      "schemaVersion": 1
    }
  },
  {
    "catalog_id": "uc",
    "course_code": "master-of-education-leadership",
    "course_title": "Master of Education (Leadership)",
    "english_proficiency_policy": [],
    "requires_english_proficiency": false,
    "section2_submission_policy": {
      "educationEvidenceLabel": "a bachelor degree or higher qualification",
      "minimumEducation": "Bachelor degree",
      "supportsExperienceAlternative": true,
      "supportsSecondaryQualification": false,
      "minimumEducationRank": 3,
      "schemaVersion": 1
    }
  },
  {
    "catalog_id": "uc",
    "course_code": "teaching-english-as-a-second-language-tesol",
    "course_title": "Teaching English as a Second Language (TESOL)",
    "english_proficiency_policy": [],
    "requires_english_proficiency": false,
    "section2_submission_policy": {
      "educationEvidenceLabel": "a bachelor degree or higher qualification",
      "minimumEducation": "Bachelor degree",
      "supportsExperienceAlternative": true,
      "supportsSecondaryQualification": false,
      "minimumEducationRank": 3,
      "schemaVersion": 1
    }
  },
  {
    "catalog_id": "uc",
    "course_code": "master-of-professional-psychology",
    "course_title": "Master of Professional Psychology",
    "english_proficiency_policy": [],
    "requires_english_proficiency": false,
    "section2_submission_policy": {
      "educationEvidenceLabel": "a bachelor degree or higher qualification",
      "minimumEducation": "Bachelor degree",
      "supportsExperienceAlternative": true,
      "supportsSecondaryQualification": false,
      "minimumEducationRank": 3,
      "schemaVersion": 1
    }
  }
]
  $course_submission_policies$::jsonb
) as policy
on conflict (catalog_id, course_code) do update
set
  course_title = excluded.course_title,
  requires_english_proficiency = excluded.requires_english_proficiency,
  english_proficiency_policy = excluded.english_proficiency_policy,
  section2_submission_policy = excluded.section2_submission_policy;

alter table public.course_submission_policies enable row level security;
revoke all on table public.course_submission_policies from public, anon, authenticated;

alter table public.applications
  add column if not exists catalog_id text;

-- Existing rows did not record their catalog. Codes that exist only in the UC
-- catalog can be identified safely; the sole shared code has the same current
-- submission policy in both catalogs and falls back to `default`.
update public.applications application
set catalog_id = 'uc'
where application.catalog_id is null
  and exists (
    select 1
    from public.course_submission_policies policy
    where policy.catalog_id = 'uc'
      and policy.course_code = application.course_code
  )
  and not exists (
    select 1
    from public.course_submission_policies policy
    where policy.catalog_id = 'default'
      and policy.course_code = application.course_code
  );

update public.applications
set catalog_id = 'default'
where catalog_id is null;

alter table public.applications
  alter column catalog_id set default 'default',
  alter column catalog_id set not null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'applications_catalog_id_check'
      and conrelid = 'public.applications'::regclass
  ) then
    alter table public.applications
      add constraint applications_catalog_id_check
      check (catalog_id in ('default', 'uc'));
  end if;
end
$$;

update public.applications application
set
  course_title = policy.course_title,
  requires_english_proficiency = policy.requires_english_proficiency,
  english_proficiency_policy = policy.english_proficiency_policy,
  section2_submission_policy = policy.section2_submission_policy
from public.course_submission_policies policy
where policy.catalog_id = application.catalog_id
  and policy.course_code = application.course_code;

create or replace function private.apply_course_submission_policy()
returns trigger
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  trusted_policy public.course_submission_policies%rowtype;
begin
  -- Preserve service-role maintenance of historical rows. Applicant RLS makes
  -- submitted rows read-only, and draft -> submitted still passes this trigger.
  if tg_op = 'UPDATE'
    and old.status = 'submitted'
    and new.status = 'submitted' then
    return new;
  end if;

  select *
  into trusted_policy
  from public.course_submission_policies policy
  where policy.catalog_id = new.catalog_id
    and policy.course_code = new.course_code;

  if not found then
    raise exception using
      errcode = '23514',
      message = 'APPLICATION_COURSE_POLICY_NOT_FOUND';
  end if;

  new.course_title := trusted_policy.course_title;
  new.requires_english_proficiency := trusted_policy.requires_english_proficiency;
  new.english_proficiency_policy := trusted_policy.english_proficiency_policy;
  new.section2_submission_policy := trusted_policy.section2_submission_policy;

  return new;
end;
$$;

revoke all on function private.apply_course_submission_policy()
  from public, anon, authenticated;

drop trigger if exists apply_course_submission_policy on public.applications;

create trigger apply_course_submission_policy
before insert or update on public.applications
for each row
execute function private.apply_course_submission_policy();

-- Replace the permissive all-operations policy with operation-specific draft
-- policies. Submitted rows remain readable to their owner.
drop policy if exists "Users manage their own applications"
  on public.applications;

drop policy if exists "Applicants read their own applications"
  on public.applications;
create policy "Applicants read their own applications"
on public.applications
for select
to authenticated
using (
  (select auth.uid()) = user_id
  and (
    applicant_profile_id is null
    or exists (
      select 1
      from public.applicant_profiles applicant_profile
      where applicant_profile.id = applications.applicant_profile_id
        and applicant_profile.owner_user_id = (select auth.uid())
    )
  )
);

drop policy if exists "Applicants create their own draft applications"
  on public.applications;
create policy "Applicants create their own draft applications"
on public.applications
for insert
to authenticated
with check (
  (select auth.uid()) = user_id
  and status = 'draft'
  and application_number is null
  and submitted_at is null
  and (
    applicant_profile_id is null
    or exists (
      select 1
      from public.applicant_profiles applicant_profile
      where applicant_profile.id = applications.applicant_profile_id
        and applicant_profile.owner_user_id = (select auth.uid())
    )
  )
);

drop policy if exists "Applicants update their own draft applications"
  on public.applications;
create policy "Applicants update their own draft applications"
on public.applications
for update
to authenticated
using (
  (select auth.uid()) = user_id
  and status = 'draft'
  and (
    applicant_profile_id is null
    or exists (
      select 1
      from public.applicant_profiles applicant_profile
      where applicant_profile.id = applications.applicant_profile_id
        and applicant_profile.owner_user_id = (select auth.uid())
    )
  )
)
with check (
  (select auth.uid()) = user_id
  and status = 'draft'
  and application_number is null
  and submitted_at is null
  and (
    applicant_profile_id is null
    or exists (
      select 1
      from public.applicant_profiles applicant_profile
      where applicant_profile.id = applications.applicant_profile_id
        and applicant_profile.owner_user_id = (select auth.uid())
    )
  )
);

drop policy if exists "Applicants delete their own draft applications"
  on public.applications;
create policy "Applicants delete their own draft applications"
on public.applications
for delete
to authenticated
using (
  (select auth.uid()) = user_id
  and status = 'draft'
);

-- Synchronize child-table writes with submit_application. The parent row lock
-- prevents a child mutation from racing the final validation and status update.
create or replace function private.enforce_draft_application_child_mutation()
returns trigger
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  target_application_id uuid;
  owner_user_id uuid;
  application_status public.application_status;
begin
  if auth.uid() is null then
    if tg_op = 'DELETE' then
      return old;
    end if;
    return new;
  end if;

  -- Foreign-key cascades are already protected by the parent application
  -- delete policy and row lock; the deleted parent is no longer queryable here.
  if tg_op = 'DELETE' and pg_trigger_depth() > 1 then
    return old;
  end if;

  if tg_op = 'DELETE' then
    target_application_id := old.application_id;
  else
    target_application_id := new.application_id;
  end if;

  select application.user_id, application.status
  into owner_user_id, application_status
  from public.applications application
  where application.id = target_application_id
  for no key update;

  if not found
    or owner_user_id <> auth.uid()
    or application_status <> 'draft' then
    raise exception using
      errcode = '42501',
      message = 'DRAFT_APPLICATION_REQUIRED';
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

revoke all on function private.enforce_draft_application_child_mutation()
  from public, anon, authenticated;

do $$
declare
  target record;
  read_policy_name text;
  insert_policy_name text;
  update_policy_name text;
  delete_policy_name text;
begin
  for target in
    select *
    from (
      values
        ('application_documents', 'Users manage documents for their own applications'),
        ('tertiary_qualifications', 'Users manage tertiary qualifications for their own applications'),
        ('employment_experiences', 'Users manage employment experiences for their own applications'),
        ('professional_accreditations', 'Users manage accreditations for their own applications'),
        ('secondary_qualifications', 'Users manage secondary qualifications for their own application'),
        ('language_tests', 'Users manage language tests for their own applications')
    ) as policies(table_name, legacy_policy_name)
  loop
    read_policy_name := format('Applicants read own %s', target.table_name);
    insert_policy_name := format('Applicants add to draft %s', target.table_name);
    update_policy_name := format('Applicants update draft %s', target.table_name);
    delete_policy_name := format('Applicants delete from draft %s', target.table_name);

    execute format(
      'drop policy if exists %I on public.%I',
      target.legacy_policy_name,
      target.table_name
    );
    execute format('drop policy if exists %I on public.%I', read_policy_name, target.table_name);
    execute format('drop policy if exists %I on public.%I', insert_policy_name, target.table_name);
    execute format('drop policy if exists %I on public.%I', update_policy_name, target.table_name);
    execute format('drop policy if exists %I on public.%I', delete_policy_name, target.table_name);

    execute format(
      $policy$
        create policy %I on public.%I
        for select to authenticated
        using (
          exists (
            select 1
            from public.applications application
            where application.id = %I.application_id
              and application.user_id = (select auth.uid())
          )
        )
      $policy$,
      read_policy_name,
      target.table_name,
      target.table_name
    );

    execute format(
      $policy$
        create policy %I on public.%I
        for insert to authenticated
        with check (
          exists (
            select 1
            from public.applications application
            where application.id = %I.application_id
              and application.user_id = (select auth.uid())
              and application.status = 'draft'
          )
        )
      $policy$,
      insert_policy_name,
      target.table_name,
      target.table_name
    );

    execute format(
      $policy$
        create policy %I on public.%I
        for update to authenticated
        using (
          exists (
            select 1
            from public.applications application
            where application.id = %I.application_id
              and application.user_id = (select auth.uid())
              and application.status = 'draft'
          )
        )
        with check (
          exists (
            select 1
            from public.applications application
            where application.id = %I.application_id
              and application.user_id = (select auth.uid())
              and application.status = 'draft'
          )
        )
      $policy$,
      update_policy_name,
      target.table_name,
      target.table_name,
      target.table_name
    );

    execute format(
      $policy$
        create policy %I on public.%I
        for delete to authenticated
        using (
          exists (
            select 1
            from public.applications application
            where application.id = %I.application_id
              and application.user_id = (select auth.uid())
              and application.status = 'draft'
          )
        )
      $policy$,
      delete_policy_name,
      target.table_name,
      target.table_name
    );

    execute format(
      'drop trigger if exists enforce_draft_parent_mutation on public.%I',
      target.table_name
    );
    execute format(
      'create trigger enforce_draft_parent_mutation before insert or update or delete on public.%I for each row execute function private.enforce_draft_application_child_mutation()',
      target.table_name
    );
  end loop;
end
$$;

-- A previous migration used the plural policy name, then a later migration
-- accidentally dropped only the singular variant. Remove either permissive copy.
drop policy if exists "Users manage secondary qualifications for their own applications"
  on public.secondary_qualifications;

-- Stored objects are part of the submitted evidence set. Owners may read them
-- after submission, but only draft applications permit object insertion/deletion.
drop policy if exists "Users manage their own application document objects"
  on storage.objects;

drop policy if exists "Applicants read their own application document objects"
  on storage.objects;
create policy "Applicants read their own application document objects"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'application-documents'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

drop policy if exists "Applicants add draft application document objects"
  on storage.objects;
create policy "Applicants add draft application document objects"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'application-documents'
  and (storage.foldername(name))[1] = (select auth.uid())::text
  and exists (
    select 1
    from public.applications application
    where application.id::text = (storage.foldername(name))[2]
      and application.user_id = (select auth.uid())
      and application.status = 'draft'
  )
);

drop policy if exists "Applicants delete draft application document objects"
  on storage.objects;
create policy "Applicants delete draft application document objects"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'application-documents'
  and (storage.foldername(name))[1] = (select auth.uid())::text
  and exists (
    select 1
    from public.applications application
    where application.id::text = (storage.foldername(name))[2]
      and application.user_id = (select auth.uid())
      and application.status = 'draft'
  )
);

create or replace function private.enforce_draft_application_storage_mutation()
returns trigger
language plpgsql
security definer
set search_path = public, storage, pg_catalog
as $$
declare
  object_row storage.objects%rowtype;
  parsed_path record;
  owner_user_id uuid;
  application_status public.application_status;
begin
  if tg_op = 'DELETE' then
    object_row := old;
  else
    object_row := new;
  end if;

  if object_row.bucket_id <> 'application-documents' or auth.uid() is null then
    if tg_op = 'DELETE' then
      return old;
    end if;
    return new;
  end if;

  select *
  into parsed_path
  from public.parse_application_document_storage_path(object_row.name);

  select application.user_id, application.status
  into owner_user_id, application_status
  from public.applications application
  where application.id = parsed_path.application_id
  for no key update;

  if not found
    or parsed_path.owner_user_id <> auth.uid()::text
    or owner_user_id <> auth.uid()
    or application_status <> 'draft' then
    raise exception using
      errcode = '42501',
      message = 'DRAFT_APPLICATION_REQUIRED';
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

revoke all on function private.enforce_draft_application_storage_mutation()
  from public, anon, authenticated;

drop trigger if exists enforce_draft_application_storage_mutation
  on storage.objects;
create trigger enforce_draft_application_storage_mutation
before insert or delete on storage.objects
for each row
execute function private.enforce_draft_application_storage_mutation();

-- The sequence and helper are internal implementation details of the submit
-- RPC; applicants must not be able to reserve or manufacture numbers directly.
revoke all on sequence public.application_number_seq
  from public, anon, authenticated;
revoke execute on function public.generate_application_number()
  from public, anon, authenticated;

create or replace function public.submit_application(target_application_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  caller_user_id uuid := auth.uid();
  missing_fields text[];
  submitted_row public.applications%rowtype;
begin
  if caller_user_id is null then
    raise exception 'Authentication is required to submit an application.';
  end if;

  select application.*
  into submitted_row
  from public.applications application
  where application.id = target_application_id
    and application.user_id = caller_user_id
  for update;

  if not found then
    raise exception 'Application not found.';
  end if;

  if submitted_row.status = 'submitted' then
    return jsonb_build_object(
      'applicationId', submitted_row.id,
      'applicationNumber', submitted_row.application_number,
      'submittedAt', submitted_row.submitted_at
    );
  end if;

  missing_fields := public.application_submission_missing_fields(target_application_id);

  if coalesce(array_length(missing_fields, 1), 0) > 0 then
    raise exception 'Application submission failed: %', array_to_string(missing_fields, ' | ');
  end if;

  update public.applications
  set
    status = 'submitted',
    application_number = public.generate_application_number(),
    submitted_at = timezone('utc', now())
  where id = target_application_id
    and user_id = caller_user_id
    and status = 'draft'
  returning *
  into submitted_row;

  if not found then
    raise exception 'Application not found.';
  end if;

  return jsonb_build_object(
    'applicationId', submitted_row.id,
    'applicationNumber', submitted_row.application_number,
    'submittedAt', submitted_row.submitted_at
  );
end;
$$;

revoke all on function public.submit_application(uuid) from public, anon;
grant execute on function public.submit_application(uuid) to authenticated;
