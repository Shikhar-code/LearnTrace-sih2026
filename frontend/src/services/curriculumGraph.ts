import {
  LearnerFrontendPayload,
  GraphNode,
  GraphEdge,
  ConceptMasteryCard,
  LEARNTRACE_FRONTEND_SCHEMA_V1,
} from "../types/intelligence";

const slug = (val: string): string => {
  return val
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^\w\s-]/g, "")
    .replace(/[\s_-]+/g, "-")
    .replace(/^-+|-+$/g, "");
};

export const conceptId = (
  classLevel: number,
  subject: string,
  chapter: string,
): string => {
  return `class-${classLevel}:${slug(subject)}:${slug(chapter)}`;
};

export const CURRICULUM_CHAPTERS: Record<string, string[]> = {
  "9:Mathematics": [
    "Orienting Yourself: The Use of Coordinates",
    "Introduction to Linear Polynomials",
    "The World of Numbers",
    "Exploring Algebraic Identities",
    "I’m Up and Down, and Round and Round",
    "Measuring Space: Perimeter and Area",
    "The Mathematics of Maybe: Introduction to Probability",
    "Predicting What Comes Next: Exploring Sequences and Progressions",
  ],
  "9:Science": [
    "Exploration: Entering the World of Secondary Science",
    "Cell: The Building Block of Life",
    "Tissues in Action",
    "Describing Motion Around Us",
    "Exploring Mixtures and their Separation",
    "How Forces Affect Motion",
    "Work, Energy, and Simple Machines",
    "Journey Inside the Atom",
    "Atomic Foundations of Matter",
    "Sound Waves: Characteristics and Applications",
    "Reproduction: How Life Continues",
    "Patterns in Life: Diversity and Classification",
    "Earth as a System: Energy, Matter, and Life",
  ],
  "10:Mathematics": [
    "Real Numbers",
    "Polynomials",
    "Pair of Linear Equations in Two Variables",
    "Quadratic Equations",
    "Arithmetic Progressions",
    "Triangles",
    "Coordinate Geometry",
    "Introduction to Trigonometry",
    "Some Applications of Trigonometry",
    "Circles",
    "Areas Related to Circles",
    "Surface Areas and Volumes",
    "Statistics",
    "Probability",
    "Appendix A1: Proofs in Mathematics",
    "Appendix A2: Mathematical Modelling",
  ],
  "10:Science": [
    "Chemical Reactions and Equations",
    "Acids, Bases and Salts",
    "Metals and Non-metals",
    "Carbon and its Compounds",
    "Life Processes",
    "Control and Coordination",
    "How do Organisms Reproduce?",
    "Heredity",
    "Light – Reflection and Refraction",
    "The Human Eye and the Colourful World",
    "Electricity",
    "Magnetic Effects of Electric Current",
    "Our Environment",
  ],
};

export const CURRICULUM_DEPENDENCIES: Array<
  [number, string, string, string, number]
> = [
  // Class 9 Mathematics
  [
    9,
    "Mathematics",
    "Introduction to Linear Polynomials",
    "The World of Numbers",
    0.85,
  ],
  [
    9,
    "Mathematics",
    "Exploring Algebraic Identities",
    "Introduction to Linear Polynomials",
    0.9,
  ],
  [
    9,
    "Mathematics",
    "Orienting Yourself: The Use of Coordinates",
    "The World of Numbers",
    0.7,
  ],
  [
    9,
    "Mathematics",
    "I’m Up and Down, and Round and Round",
    "Orienting Yourself: The Use of Coordinates",
    0.7,
  ],
  [
    9,
    "Mathematics",
    "Measuring Space: Perimeter and Area",
    "I’m Up and Down, and Round and Round",
    0.8,
  ],
  [
    9,
    "Mathematics",
    "The Mathematics of Maybe: Introduction to Probability",
    "The World of Numbers",
    0.65,
  ],
  [
    9,
    "Mathematics",
    "Predicting What Comes Next: Exploring Sequences and Progressions",
    "Introduction to Linear Polynomials",
    0.8,
  ],

  // Class 9 Science
  [
    9,
    "Science",
    "Cell: The Building Block of Life",
    "Exploration: Entering the World of Secondary Science",
    0.6,
  ],
  [9, "Science", "Tissues in Action", "Cell: The Building Block of Life", 0.9],
  [
    9,
    "Science",
    "Reproduction: How Life Continues",
    "Cell: The Building Block of Life",
    0.8,
  ],
  [
    9,
    "Science",
    "Patterns in Life: Diversity and Classification",
    "Cell: The Building Block of Life",
    0.65,
  ],
  [
    9,
    "Science",
    "Exploring Mixtures and their Separation",
    "Atomic Foundations of Matter",
    0.75,
  ],
  [
    9,
    "Science",
    "Atomic Foundations of Matter",
    "Journey Inside the Atom",
    0.9,
  ],
  [
    9,
    "Science",
    "How Forces Affect Motion",
    "Describing Motion Around Us",
    0.9,
  ],
  [
    9,
    "Science",
    "Work, Energy, and Simple Machines",
    "How Forces Affect Motion",
    0.85,
  ],
  [
    9,
    "Science",
    "Sound Waves: Characteristics and Applications",
    "Describing Motion Around Us",
    0.7,
  ],
  [
    9,
    "Science",
    "Earth as a System: Energy, Matter, and Life",
    "Patterns in Life: Diversity and Classification",
    0.65,
  ],
  [
    9,
    "Science",
    "Earth as a System: Energy, Matter, and Life",
    "Atomic Foundations of Matter",
    0.55,
  ],

  // Class 10 Mathematics
  [10, "Mathematics", "Polynomials", "Real Numbers", 0.8],
  [
    10,
    "Mathematics",
    "Pair of Linear Equations in Two Variables",
    "Polynomials",
    0.85,
  ],
  [10, "Mathematics", "Quadratic Equations", "Polynomials", 0.9],
  [
    10,
    "Mathematics",
    "Arithmetic Progressions",
    "Pair of Linear Equations in Two Variables",
    0.65,
  ],
  [
    10,
    "Mathematics",
    "Coordinate Geometry",
    "Pair of Linear Equations in Two Variables",
    0.7,
  ],
  [10, "Mathematics", "Introduction to Trigonometry", "Triangles", 0.9],
  [
    10,
    "Mathematics",
    "Some Applications of Trigonometry",
    "Introduction to Trigonometry",
    0.95,
  ],
  [10, "Mathematics", "Circles", "Triangles", 0.8],
  [10, "Mathematics", "Areas Related to Circles", "Circles", 0.9],
  [
    10,
    "Mathematics",
    "Surface Areas and Volumes",
    "Areas Related to Circles",
    0.8,
  ],
  [10, "Mathematics", "Statistics", "Real Numbers", 0.55],
  [10, "Mathematics", "Probability", "Statistics", 0.8],
  [10, "Mathematics", "Appendix A1: Proofs in Mathematics", "Triangles", 0.5],
  [
    10,
    "Mathematics",
    "Appendix A2: Mathematical Modelling",
    "Pair of Linear Equations in Two Variables",
    0.6,
  ],
  [
    10,
    "Mathematics",
    "Appendix A2: Mathematical Modelling",
    "Statistics",
    0.55,
  ],

  // Class 10 Science
  [
    10,
    "Science",
    "Acids, Bases and Salts",
    "Chemical Reactions and Equations",
    0.85,
  ],
  [
    10,
    "Science",
    "Metals and Non-metals",
    "Chemical Reactions and Equations",
    0.8,
  ],
  [
    10,
    "Science",
    "Carbon and its Compounds",
    "Chemical Reactions and Equations",
    0.75,
  ],
  [10, "Science", "Control and Coordination", "Life Processes", 0.85],
  [10, "Science", "How do Organisms Reproduce?", "Life Processes", 0.8],
  [10, "Science", "Heredity", "How do Organisms Reproduce?", 0.9],
  [
    10,
    "Science",
    "The Human Eye and the Colourful World",
    "Light – Reflection and Refraction",
    0.9,
  ],
  [10, "Science", "Magnetic Effects of Electric Current", "Electricity", 0.95],
  [10, "Science", "Our Environment", "Life Processes", 0.65],
  [10, "Science", "Our Environment", "Carbon and its Compounds", 0.55],
];

/**
 * Builds an authentic, unassessed baseline Knowledge Graph DAG for any NCERT Class and Subject.
 */
export const buildBaselineCurriculumGraph = (
  classLevel: number,
  subject: string,
  targetConceptId?: string,
): LearnerFrontendPayload => {
  const key = `${classLevel}:${subject}`;
  const chapters = CURRICULUM_CHAPTERS[key] || [
    "Foundational Concepts",
    "Core Principles",
    "Advanced Applications",
  ];

  const nodeMap = new Map<
    string,
    { id: string; label: string; parents: string[] }
  >();
  for (const chap of chapters) {
    const id = conceptId(classLevel, subject, chap);
    nodeMap.set(id, { id, label: chap, parents: [] });
  }

  // Filter relevant dependencies
  const edges: GraphEdge[] = [];
  for (const [
    lvl,
    sub,
    conceptName,
    prereqName,
    weight,
  ] of CURRICULUM_DEPENDENCIES) {
    if (lvl === classLevel && sub.toLowerCase() === subject.toLowerCase()) {
      const targetId = conceptId(lvl, sub, conceptName);
      const sourceId = conceptId(lvl, sub, prereqName);

      if (nodeMap.has(targetId) && nodeMap.has(sourceId)) {
        nodeMap.get(targetId)?.parents.push(sourceId);
        edges.push({
          id: `${sourceId}->${targetId}`,
          source: sourceId,
          target: targetId,
          weight: Math.round(weight * 10000) / 10000,
          in_root_trace: false,
          in_learning_path: false,
        });
      }
    }
  }

  // Compute topological hierarchy levels
  const computeLevel = (cId: string, visited = new Set<string>()): number => {
    if (visited.has(cId)) return 0;
    visited.add(cId);
    const node = nodeMap.get(cId);
    if (!node || node.parents.length === 0) return 0;
    let maxP = 0;
    for (const p of node.parents) {
      maxP = Math.max(maxP, computeLevel(p, new Set(visited)) + 1);
    }
    return maxP;
  };

  const defaultTarget = targetConceptId || Array.from(nodeMap.keys())[0] || "";

  const nodes: GraphNode[] = Array.from(nodeMap.values()).map((n) => {
    const isTarget = n.id === defaultTarget;
    return {
      id: n.id,
      label: n.label,
      assessed: false,
      mastery_probability: null,
      mastery_score: null,
      tier: "UNKNOWN",
      confidence: null,
      confidence_label: null,
      can_progress: false,
      level: computeLevel(n.id),
      roles: isTarget ? ["TARGET", "DIAGNOSTIC_REQUIRED"] : [],
    };
  });

  const masteryProfile: ConceptMasteryCard[] = nodes.map((n) => ({
    id: n.id,
    label: n.label,
    assessed: false,
    mastery_probability: null,
    mastery_score: null,
    tier: "UNKNOWN",
    confidence: null,
    confidence_label: null,
    can_progress: false,
  }));

  const targetNode =
    nodeMap.get(defaultTarget) || Array.from(nodeMap.values())[0];

  return {
    schema_version: LEARNTRACE_FRONTEND_SCHEMA_V1,
    summary: {
      target: {
        id: targetNode?.id || defaultTarget,
        label: targetNode?.label || "Target Concept",
        assessed: false,
        mastery_probability: null,
        mastery_score: null,
        tier: "UNKNOWN",
        confidence: null,
        confidence_label: null,
        can_progress: false,
      },
      readiness_score: null,
      readiness_formula: "CONFIDENCE_WEIGHTED_MEAN",
      strongest_concepts: [],
      weakest_concepts: [],
      root_gap_probability: 0,
      next_action: {
        type: "TAKE_DIAGNOSTIC",
        concept_id: targetNode?.id || defaultTarget,
        label: targetNode?.label || "Target Concept",
      },
    },
    mastery_profile: masteryProfile,
    graphs: {
      competency: {
        direction: "PREREQUISITE_TO_DEPENDENT",
        node_count: nodes.length,
        edge_count: edges.length,
        nodes,
        edges,
      },
      root_cause: {
        direction: "PREREQUISITE_TO_DEPENDENT",
        node_count: 1,
        edge_count: 0,
        nodes: [
          {
            id: targetNode?.id || defaultTarget,
            label: targetNode?.label || "Target Concept",
            assessed: false,
            mastery_probability: null,
            mastery_score: null,
            tier: "UNKNOWN",
            confidence: null,
            confidence_label: null,
            can_progress: false,
            level: 0,
            roles: ["TARGET", "DIAGNOSTIC_REQUIRED"],
          },
        ],
        edges: [],
      },
    },
    learning_path: null,
    progress: {
      assessment_scores: [],
      concept_improvement: [],
    },
  };
};
