const mongoose = require('mongoose');
const User = require('../models/User');
const Course = require('../models/Course');
const Enrollment = require('../models/Enrollment');
const Progress = require('../models/Progress');
const QuizAttempt = require('../models/QuizAttempt');
const AssignmentSubmission = require('../models/AssignmentSubmission');
const { connectDatabase } = require('../config/database');
const { recalculateCourseProgress } = require('./lmsProgress');

const today = new Date().toISOString().slice(0, 10);
  //just to check the changes
const demoUsers = [
  {
    name: 'Dr. Hina Siddiqui',
    email: 'hina.admin@learnify.test',
    password: 'Admin@123',
    role: 'admin',
  },
  {
    name: 'Dr. Ahmed Raza',
    email: 'ahmed.raza@learnify.test',
    password: 'Instructor@123',
    role: 'instructor',
    department: 'Computer Science',
  },
  {
    name: 'Ms. Fatima Noor',
    email: 'fatima.noor@learnify.test',
    password: 'Instructor@123',
    role: 'instructor',
    department: 'Computer Science',
  },
  {
    name: 'Engr. Bilal Hassan',
    email: 'bilal.hassan@learnify.test',
    password: 'Instructor@123',
    role: 'instructor',
    department: 'Software Engineering',
  },
  {
    name: 'Ali Khan',
    email: 'ali.khan@student.learnify.test',
    password: 'Student@123',
    role: 'student',
    degreeProgram: 'BS Computer Science',
    semester: 5,
  },
  {
    name: 'Ayesha Malik',
    email: 'ayesha.malik@student.learnify.test',
    password: 'Student@123',
    role: 'student',
    degreeProgram: 'BS Software Engineering',
    semester: 3,
  },
  {
    name: 'Usman Tariq',
    email: 'usman.tariq@student.learnify.test',
    password: 'Student@123',
    role: 'student',
    degreeProgram: 'BS Data Science',
    semester: 4,
  },
  {
    name: 'Zainab Ahmed',
    email: 'zainab.ahmed@student.learnify.test',
    password: 'Student@123',
    role: 'student',
    degreeProgram: 'BS Artificial Intelligence',
    semester: 6,
  },
  {
    name: 'Hamza Farooq',
    email: 'hamza.farooq@student.learnify.test',
    password: 'Student@123',
    role: 'student',
    degreeProgram: 'BS Computer Science',
    semester: 2,
  },
  {
    name: 'Mariam Shah',
    email: 'mariam.shah@student.learnify.test',
    password: 'Student@123',
    role: 'student',
    degreeProgram: 'BS Software Engineering',
    semester: 7,
  },
];

function contentItem(id, title) {
  return {
    id,
    type: 'content',
    title,
    fileType: 'pdf',
    link: '',
    fileName: `${title}.pdf`,
    files: [],
    isDelivered: true,
  };
}

function quizItem(id, title) {
  return {
    id,
    type: 'quiz',
    title,
    instructions: 'Read each question carefully and choose the best answer.',
    timeLimitMinutes: 15,
    maxAttempts: 2,
    isDelivered: true,
    questionsCount: 3,
    questions: [
      {
        id: 1,
        text: 'Which option best matches the main concept of this module?',
        options: ['Definition', 'Syntax only', 'Formatting', 'Deployment'],
        answer: 0,
        points: 2,
      },
      {
        id: 2,
        text: 'What should students practice after studying this topic?',
        options: ['Ignore examples', 'Solve exercises', 'Skip assessment', 'Only read slides'],
        answer: 1,
        points: 2,
      },
      {
        id: 3,
        text: 'Why is this topic important?',
        options: ['It improves problem solving', 'It avoids learning', 'It removes testing', 'It is optional only'],
        answer: 0,
        points: 1,
      },
    ],
  };
}

function assignmentItem(id, title) {
  return {
    id,
    type: 'assignment',
    title,
    instructions: 'Submit a short PDF or document showing your work and explanation.',
    openedAt: `${today}T09:00`,
    dueAt: `${today}T23:59`,
    gradingStatus: 'Points based',
    requiresStudentUpload: true,
    submissionOpen: true,
    fileSubmissionEnabled: true,
    attachments: [],
    submissions: [],
    isDelivered: true,
  };
}

function moduleData(id, title, contentTitle, quizTitle, assignmentTitle) {
  const base = id * 100;
  return {
    id,
    title,
    items: [
      contentItem(base + 1, contentTitle),
      quizItem(base + 2, quizTitle),
      assignmentItem(base + 3, assignmentTitle),
    ],
  };
}

const demoCourses = [
  {
    title: 'Programming Fundamentals',
    subtitle: 'Learn the basics of programming using C++',
    instructorEmail: 'ahmed.raza@learnify.test',
    instructor: 'Dr. Ahmed Raza',
    category: 'Computer Science',
    enrollmentKey: 'CS101',
    description:
      'This course introduces students to programming concepts including variables, control structures, functions, arrays, and basic problem solving using C++.',
    modules: [
      moduleData(
        1,
        'Introduction to Programming',
        'Introduction to Algorithms and Flowcharts',
        'Quiz 1 - Programming Basics',
        'Assignment 1 - Flowchart and Pseudocode Practice',
      ),
      moduleData(
        2,
        'C++ Basics',
        'Variables, Data Types, and Operators',
        'Quiz 2 - C++ Syntax and Operators',
        'Assignment 2 - Basic C++ Programs',
      ),
    ],
  },
  {
    title: 'Object Oriented Programming',
    subtitle: 'Understand classes, objects, inheritance, and polymorphism',
    instructorEmail: 'ahmed.raza@learnify.test',
    instructor: 'Dr. Ahmed Raza',
    category: 'Computer Science',
    enrollmentKey: 'CS201',
    description:
      'This course teaches object oriented programming concepts using C++, including classes, objects, constructors, inheritance, polymorphism, and encapsulation.',
    modules: [
      moduleData(
        1,
        'Classes and Objects',
        'Introduction to Classes and Objects',
        'Quiz 1 - OOP Concepts',
        'Assignment 1 - Student Record Class',
      ),
      moduleData(
        2,
        'Inheritance and Polymorphism',
        'Inheritance, Function Overriding, and Virtual Functions',
        'Quiz 2 - Inheritance and Polymorphism',
        'Assignment 2 - Library Management Classes',
      ),
    ],
  },
  {
    title: 'Data Structures and Algorithms',
    subtitle: 'Learn arrays, linked lists, stacks, queues, trees, and searching algorithms',
    instructorEmail: 'fatima.noor@learnify.test',
    instructor: 'Ms. Fatima Noor',
    category: 'Computer Science',
    enrollmentKey: 'CS301',
    description:
      'This course covers core data structures and algorithms required for efficient problem solving and software development.',
    modules: [
      moduleData(
        1,
        'Linear Data Structures',
        'Arrays, Linked Lists, Stacks, and Queues',
        'Quiz 1 - Linear Data Structures',
        'Assignment 1 - Stack and Queue Implementation',
      ),
      moduleData(
        2,
        'Trees and Searching',
        'Binary Trees, BST, Linear Search, and Binary Search',
        'Quiz 2 - Trees and Searching',
        'Assignment 2 - Binary Search Tree Operations',
      ),
    ],
  },
  {
    title: 'Database Management Systems',
    subtitle: 'Design and query relational databases using SQL',
    instructorEmail: 'fatima.noor@learnify.test',
    instructor: 'Ms. Fatima Noor',
    category: 'Database Systems',
    enrollmentKey: 'CS302',
    description:
      'This course introduces database concepts, ER modeling, normalization, SQL queries, joins, constraints, and transaction management.',
    modules: [
      moduleData(
        1,
        'Database Design',
        'ER Diagrams and Relational Model',
        'Quiz 1 - Database Design Concepts',
        'Assignment 1 - ER Diagram for University System',
      ),
      moduleData(
        2,
        'SQL and Normalization',
        'SQL Queries, Joins, and Normal Forms',
        'Quiz 2 - SQL and Normalization',
        'Assignment 2 - SQL Query Practice',
      ),
    ],
  },
  {
    title: 'Web Engineering',
    subtitle: 'Build modern web applications using HTML, CSS, JavaScript, React, and Node.js',
    instructorEmail: 'bilal.hassan@learnify.test',
    instructor: 'Engr. Bilal Hassan',
    category: 'Software Engineering',
    enrollmentKey: 'SE401',
    description:
      'This course focuses on frontend and backend web development, covering responsive design, React components, REST APIs, authentication, and database integration.',
    modules: [
      moduleData(
        1,
        'Frontend Development',
        'HTML, CSS, JavaScript, and React Basics',
        'Quiz 1 - Frontend Fundamentals',
        'Assignment 1 - Responsive Portfolio Page',
      ),
      moduleData(
        2,
        'Backend Development',
        'Node.js, Express APIs, and MongoDB Integration',
        'Quiz 2 - Backend and REST APIs',
        'Assignment 2 - Student Management API',
      ),
    ],
  },
  {
    title: 'Software Engineering',
    subtitle: 'Plan, design, test, and maintain reliable software systems',
    instructorEmail: 'bilal.hassan@learnify.test',
    instructor: 'Engr. Bilal Hassan',
    category: 'Software Engineering',
    enrollmentKey: 'SE301',
    description:
      'This course explains software development life cycle models, requirements engineering, UML design, testing, and project management.',
    modules: [
      moduleData(
        1,
        'Software Process Models',
        'SDLC, Waterfall, Agile, and Scrum',
        'Quiz 1 - SDLC and Agile Basics',
        'Assignment 1 - Requirement Analysis Document',
      ),
      moduleData(
        2,
        'Design and Testing',
        'UML Diagrams, Test Cases, and Quality Assurance',
        'Quiz 2 - UML and Testing',
        'Assignment 2 - Test Plan for LMS Module',
      ),
    ],
  },
];

const demoEnrollments = {
  'ali.khan@student.learnify.test': [
    'Programming Fundamentals',
    'Web Engineering',
    'Database Management Systems',
  ],
  'ayesha.malik@student.learnify.test': [
    'Object Oriented Programming',
    'Data Structures and Algorithms',
    'Software Engineering',
  ],
  'usman.tariq@student.learnify.test': [
    'Programming Fundamentals',
    'Object Oriented Programming',
  ],
  'zainab.ahmed@student.learnify.test': [
    'Database Management Systems',
    'Software Engineering',
    'Web Engineering',
  ],
  'hamza.farooq@student.learnify.test': [
    'Data Structures and Algorithms',
    'Web Engineering',
  ],
  'mariam.shah@student.learnify.test': [
    'Programming Fundamentals',
    'Database Management Systems',
    'Software Engineering',
  ],
};

async function upsertUser(userData) {
  let user = await User.findOne({ email: userData.email }).select('+password');
  if (!user) {
    user = new User(userData);
  } else {
    user.name = userData.name;
    user.role = userData.role;
    user.active = true;
    user.password = userData.password;
  }

  if (userData.role === 'student') {
    user.degreeProgram = userData.degreeProgram;
    user.semester = userData.semester;
  }

  if (userData.department) {
    user.address = `${userData.department} Department`;
  }

  await user.save();
  return user;
}

async function getNextCourseId() {
  const latest = await Course.findOne().sort({ id: -1 }).select('id');
  return latest?.id ? latest.id + 1 : 1;
}

async function upsertCourse(courseData) {
  const instructor = await User.findOne({ email: courseData.instructorEmail });
  let course = await Course.findOne({ title: courseData.title });

  if (!course) {
    course = new Course({
      id: await getNextCourseId(),
      title: courseData.title,
    });
  }

  course.subtitle = courseData.subtitle;
  course.description = courseData.description;
  course.instructor = courseData.instructor;
  course.category = courseData.category;
  course.enrollmentKey = courseData.enrollmentKey;
  course.imageClass = 'courseImageBlue';
  course.lastAccessed = today;
  course.ownerEmail = instructor?.email || courseData.instructorEmail;
  course.modules = courseData.modules;

  await course.save();
  return course;
}

function getCourseItems(course) {
  return (course.modules || []).flatMap((module) => module.items || []);
}

async function seedActivity(student, course, index) {
  const items = getCourseItems(course);
  const completedCount = Math.max(1, Math.min(items.length, 2 + (index % items.length)));
  const completedItems = items.slice(0, completedCount);

  for (const item of completedItems) {
    await Progress.findOneAndUpdate(
      { studentEmail: student.email, courseId: course.id, itemId: item.id },
      {
        $set: {
          student: student._id,
          course: course._id,
          studentEmail: student.email,
          courseId: course.id,
          itemId: item.id,
          itemType: item.type || 'content',
          completed: true,
          openedAt: new Date(),
          completedAt: new Date(),
          timeSpentSeconds: 300 + index * 60,
          lastActivityAt: new Date(),
        },
      },
      { upsert: true },
    );

    if (item.type === 'quiz') {
      await QuizAttempt.findOneAndUpdate(
        { student: student._id, course: course._id, quizItemId: item.id, attemptNo: 1 },
        {
          $set: {
            student: student._id,
            course: course._id,
            courseId: course.id,
            quizItemId: item.id,
            attemptNo: 1,
            answers: [
              { questionId: 1, selectedAnswer: 0 },
              { questionId: 2, selectedAnswer: 1 },
              { questionId: 3, selectedAnswer: index % 2 === 0 ? 0 : 2 },
            ],
            score: index % 2 === 0 ? 5 : 4,
            totalMarks: 5,
            percentage: index % 2 === 0 ? 100 : 80,
            startedAt: new Date(Date.now() - 900000),
            submittedAt: new Date(),
            durationSeconds: 600 + index * 20,
            autoSubmitted: false,
            status: 'submitted',
          },
        },
        { upsert: true },
      );
    }

    if (item.type === 'assignment') {
      await AssignmentSubmission.findOneAndUpdate(
        { student: student._id, course: course._id, assignmentItemId: item.id },
        {
          $set: {
            student: student._id,
            course: course._id,
            courseId: course.id,
            assignmentItemId: item.id,
            textSubmission: 'Submitted demo assignment for presentation review.',
            files: [
              {
                id: `demo-${student._id}-${course.id}-${item.id}`,
                name: `${student.name.replace(/\s+/g, '-')}-${item.title}.pdf`,
                mimeType: 'application/pdf',
                dataUrl: '',
              },
            ],
            submittedAt: new Date(),
            status: index % 3 === 0 ? 'graded' : 'submitted',
            grade: index % 3 === 0 ? '8/10' : '',
            maxGrade: '10',
            feedback: index % 3 === 0 ? 'Good work. Improve explanation clarity.' : '',
          },
        },
        { upsert: true },
      );
    }
  }

  await recalculateCourseProgress(student, course);
}

async function seedDemoData() {
  await connectDatabase();

  const users = new Map();
  for (const userData of demoUsers) {
    const user = await upsertUser(userData);
    users.set(user.email, user);
  }

  const courses = new Map();
  for (const courseData of demoCourses) {
    const course = await upsertCourse(courseData);
    courses.set(course.title, course);
  }

  let activityIndex = 0;
  for (const [studentEmail, courseTitles] of Object.entries(demoEnrollments)) {
    const student = users.get(studentEmail);
    if (!student) continue;

    for (const title of courseTitles) {
      const course = courses.get(title);
      if (!course) continue;

      const enrollment = await Enrollment.findOneAndUpdate(
        { studentEmail: student.email, courseId: course.id },
        {
          $set: {
            student: student._id,
            course: course._id,
            studentEmail: student.email,
            courseId: course.id,
            status: 'active',
            enrolledAt: new Date(),
            lastActivityAt: new Date(),
          },
        },
        { upsert: true, returnDocument: 'after' },
      );

      activityIndex += 1;
      await seedActivity(student, course, activityIndex);

      const progress = await recalculateCourseProgress(student, course);
      enrollment.progressPercent = progress.progressPercent;
      enrollment.lastActivityAt = new Date();
      await enrollment.save();
    }
  }

  console.log(
    JSON.stringify(
      {
        success: true,
        message: 'Demo data seeded successfully.',
        users: demoUsers.length,
        courses: demoCourses.length,
        enrollments: Object.values(demoEnrollments).reduce((sum, list) => sum + list.length, 0),
      },
      null,
      2,
    ),
  );

  await mongoose.disconnect();
}

seedDemoData().catch(async (error) => {
  console.error(error);
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});
