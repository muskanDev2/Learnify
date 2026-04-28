import { useMemo, useState } from 'react';
import { getCurrentUser } from '../utils/authUtils';

const COURSES_KEY = 'learnify_courses';

function getStoredCourses() {
  const rawCourses = localStorage.getItem(COURSES_KEY);
  if (!rawCourses) return [];

  try {
    const parsed = JSON.parse(rawCourses);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveStoredCourses(courses) {
  localStorage.setItem(COURSES_KEY, JSON.stringify(courses));
}

function getNextId(items) {
  return items.length ? Math.max(...items.map((item) => item.id)) + 1 : 1;
}

function buildStarterModules() {
  return [
    { id: 1, title: 'General', materials: [] },
    { id: 2, title: 'Introduction', materials: [] },
  ];
}

function getCourseProgress(course) {
  const allMaterials = course.modules.flatMap((module) => module.materials);
  if (allMaterials.length === 0) return 0;
  const deliveredCount = allMaterials.filter((material) => material.isDelivered).length;
  return Math.round((deliveredCount / allMaterials.length) * 100);
}

export default function InstructorCoursesPanel() {
  const currentUser = getCurrentUser();
  const instructorName = currentUser?.name || 'Instructor';
  const instructorEmail = (currentUser?.email || '').toLowerCase();
  const [courses, setCourses] = useState(() =>
    getStoredCourses()
      .filter((course) => course.ownerEmail === instructorEmail)
      .map((course) => ({
        ...course,
        modules: course.modules || buildStarterModules(),
      })),
  );
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('All');
  const [sortBy, setSortBy] = useState('last-accessed');
  const [viewType, setViewType] = useState('card');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [deletingCourseId, setDeletingCourseId] = useState(null);
  const [editingCourseId, setEditingCourseId] = useState(null);
  const [selectedCourseId, setSelectedCourseId] = useState(null);
  const [newModuleTitle, setNewModuleTitle] = useState('');
  const [materialForm, setMaterialForm] = useState({
    moduleId: '',
    title: '',
    type: 'video',
    link: '',
    fileName: '',
  });
  const [courseForm, setCourseForm] = useState({
    title: '',
    subtitle: '',
    description: '',
    instructor: instructorName,
    category: '',
  });

  const filteredCourses = useMemo(() => {
    const searched = courses.filter((course) =>
      course.title.toLowerCase().includes(searchTerm.trim().toLowerCase()),
    );

    const categorized = searched.filter((course) =>
      categoryFilter === 'All' ? true : course.category === categoryFilter,
    );

    return [...categorized].sort((a, b) => {
      if (sortBy === 'name') {
        return a.title.localeCompare(b.title);
      }
      return new Date(b.lastAccessed) - new Date(a.lastAccessed);
    });
  }, [courses, searchTerm, categoryFilter, sortBy]);

  const selectedCourse = courses.find((course) => course.id === selectedCourseId) || null;

  function persistInstructorCourses(updatedCourses) {
    const otherUsersCourses = getStoredCourses().filter(
      (course) => course.ownerEmail !== instructorEmail,
    );
    saveStoredCourses([...otherUsersCourses, ...updatedCourses]);
  }

  function updateInstructorCourses(updater) {
    setCourses((prev) => {
      const updatedCourses = updater(prev);
      persistInstructorCourses(updatedCourses);
      return updatedCourses;
    });
  }

  function openCreateModal() {
    setEditingCourseId(null);
    setCourseForm({
      title: '',
      subtitle: '',
      description: '',
      instructor: instructorName,
      category: '',
    });
    setIsModalOpen(true);
  }

  function openEditModal(course) {
    setEditingCourseId(course.id);
    setCourseForm({
      title: course.title,
      subtitle: course.subtitle,
      description: course.description || '',
      instructor: course.instructor || instructorName,
      category: course.category,
    });
    setIsModalOpen(true);
  }

  function handleFormChange(event) {
    const { name, value } = event.target;
    setCourseForm((prev) => ({ ...prev, [name]: value }));
  }

  function handleSaveCourse() {
    if (
      !courseForm.title.trim() ||
      !courseForm.subtitle.trim() ||
      !courseForm.description.trim() ||
      !courseForm.category.trim()
    ) {
      return;
    }

    if (editingCourseId) {
      updateInstructorCourses((prev) => {
        const updatedCourses = prev.map((course) =>
          course.id === editingCourseId
            ? {
                ...course,
                ...courseForm,
                instructor: course.instructor || instructorName,
                lastAccessed: new Date().toISOString().slice(0, 10),
              }
            : course,
        );
        return updatedCourses;
      });
    } else {
      updateInstructorCourses((prev) => {
        const nextId = getNextId(prev);
        const newCourse = {
          id: nextId,
          title: courseForm.title.trim(),
          subtitle: courseForm.subtitle.trim(),
          description: courseForm.description.trim(),
          instructor: instructorName,
          category: courseForm.category.trim(),
          imageClass: 'courseImageBlue',
          lastAccessed: new Date().toISOString().slice(0, 10),
          ownerEmail: instructorEmail,
          modules: buildStarterModules(),
        };
        const updatedCourses = [newCourse, ...prev];
        return updatedCourses;
      });
    }

    setIsModalOpen(false);
  }

  function handleDeleteCourse(courseId) {
    setDeletingCourseId(courseId);
  }

  function confirmDeleteCourse() {
    if (!deletingCourseId) return;
    updateInstructorCourses((prev) => {
      const updatedCourses = prev.filter((course) => course.id !== deletingCourseId);
      return updatedCourses;
    });
    if (selectedCourseId === deletingCourseId) {
      setSelectedCourseId(null);
    }
    setDeletingCourseId(null);
  }

  function openContentManager(courseId) {
    setSelectedCourseId(courseId);
    const course = courses.find((item) => item.id === courseId);
    const defaultModuleId = course?.modules?.[0]?.id || '';
    setMaterialForm({
      moduleId: defaultModuleId,
      title: '',
      type: 'video',
      link: '',
      fileName: '',
    });
  }

  function handleAddModule() {
    if (!selectedCourse || !newModuleTitle.trim()) return;

    updateInstructorCourses((prev) =>
      prev.map((course) => {
        if (course.id !== selectedCourse.id) return course;
        const nextModuleId = getNextId(course.modules);
        return {
          ...course,
          modules: [...course.modules, { id: nextModuleId, title: newModuleTitle.trim(), materials: [] }],
        };
      }),
    );

    setNewModuleTitle('');
  }

  function handleDeleteModule(moduleId) {
    if (!selectedCourse) return;

    updateInstructorCourses((prev) =>
      prev.map((course) =>
        course.id === selectedCourse.id
          ? { ...course, modules: course.modules.filter((module) => module.id !== moduleId) }
          : course,
      ),
    );
  }

  function handleMaterialFormChange(event) {
    const { name, value } = event.target;
    setMaterialForm((prev) => ({ ...prev, [name]: value }));
  }

  function handleMaterialFileChange(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    setMaterialForm((prev) => ({ ...prev, fileName: file.name }));
  }

  function handleUploadMaterial() {
    if (!selectedCourse || !materialForm.moduleId || !materialForm.title.trim()) return;

    updateInstructorCourses((prev) =>
      prev.map((course) => {
        if (course.id !== selectedCourse.id) return course;

        const updatedModules = course.modules.map((module) => {
          if (module.id !== Number(materialForm.moduleId)) return module;
          const nextMaterialId = getNextId(module.materials);

          return {
            ...module,
            materials: [
              ...module.materials,
              {
                id: nextMaterialId,
                title: materialForm.title.trim(),
                type: materialForm.type,
                link: materialForm.link.trim(),
                fileName: materialForm.fileName,
                isDelivered: false,
              },
            ],
          };
        });

        return { ...course, modules: updatedModules };
      }),
    );

    setMaterialForm((prev) => ({
      ...prev,
      title: '',
      link: '',
      fileName: '',
    }));
  }

  function toggleMaterialDelivered(moduleId, materialId) {
    if (!selectedCourse) return;

    updateInstructorCourses((prev) =>
      prev.map((course) => {
        if (course.id !== selectedCourse.id) return course;

        const updatedModules = course.modules.map((module) => {
          if (module.id !== moduleId) return module;

          return {
            ...module,
            materials: module.materials.map((material) =>
              material.id === materialId
                ? { ...material, isDelivered: !material.isDelivered }
                : material,
            ),
          };
        });

        return { ...course, modules: updatedModules };
      }),
    );
  }

  function deleteMaterial(moduleId, materialId) {
    if (!selectedCourse) return;

    updateInstructorCourses((prev) =>
      prev.map((course) => {
        if (course.id !== selectedCourse.id) return course;

        const updatedModules = course.modules.map((module) =>
          module.id === moduleId
            ? {
                ...module,
                materials: module.materials.filter((material) => material.id !== materialId),
              }
            : module,
        );

        return { ...course, modules: updatedModules };
      }),
    );
  }

  return (
    <section className="myCoursesSection">
      <div className="myCoursesHeader">
        <div>
          <h2>My courses</h2>
          <h3>Course overview</h3>
        </div>
        <button type="button" className="profilePrimaryButton" onClick={openCreateModal}>
          Create Course
        </button>
      </div>

      <div className="myCoursesFilters">
        <select value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value)}>
          <option value="All">All</option>
          <option value="AI">AI</option>
          <option value="Robotics">Robotics</option>
          <option value="Computer Science">Computer Science</option>
        </select>

        <input
          type="search"
          placeholder="Search"
          value={searchTerm}
          onChange={(event) => setSearchTerm(event.target.value)}
        />

        <select value={sortBy} onChange={(event) => setSortBy(event.target.value)}>
          <option value="last-accessed">Sort by last accessed</option>
          <option value="name">Sort by course name</option>
        </select>

        <select value={viewType} onChange={(event) => setViewType(event.target.value)}>
          <option value="card">Card</option>
          <option value="list">List</option>
        </select>
      </div>

      <div className={viewType === 'card' ? 'myCoursesGrid' : 'myCoursesList'}>
        {filteredCourses.length === 0 ? (
          <div className="myCoursesEmptyState" role="status">
            No courses added yet. Start by clicking <strong>Create Course</strong> to build your first course.
          </div>
        ) : (
          filteredCourses.map((course) => (
            <article key={course.id} className="myCourseCard">
              <div className={`myCourseImage ${course.imageClass}`} />
              <div className="myCourseBody">
                <h4>{course.title}</h4>
                <p>{course.subtitle}</p>
                <small>{course.description}</small>
                <small>Instructor: {course.instructor}</small>
                <small>{course.category}</small>
              </div>
              <div className="myCourseActions">
              <button type="button" onClick={() => openContentManager(course.id)}>
                Manage Content
              </button>
                <button type="button" onClick={() => openEditModal(course)}>Edit</button>
                <button type="button" onClick={() => handleDeleteCourse(course.id)}>Delete</button>
              </div>
            </article>
          ))
        )}
      </div>

      {selectedCourse && (
        <section className="courseContentManager">
          <div className="courseContentHeader">
            <h3>{selectedCourse.title} - Content Delivery</h3>
            <span className="dashboardRoleBadge">
              Progress {getCourseProgress(selectedCourse)}%
            </span>
          </div>

          <div className="courseContentStats">
            <article>
              <h4>Modules</h4>
              <p>{selectedCourse.modules.length}</p>
            </article>
            <article>
              <h4>Total Materials</h4>
              <p>{selectedCourse.modules.reduce((sum, module) => sum + module.materials.length, 0)}</p>
            </article>
            <article>
              <h4>Delivered</h4>
              <p>
                {
                  selectedCourse.modules
                    .flatMap((module) => module.materials)
                    .filter((material) => material.isDelivered).length
                }
              </p>
            </article>
          </div>

          <div className="courseModuleAddRow">
            <input
              type="text"
              placeholder="Add new module (for example: Week 1, Introduction)"
              value={newModuleTitle}
              onChange={(event) => setNewModuleTitle(event.target.value)}
            />
            <button type="button" className="profilePrimaryButton" onClick={handleAddModule}>
              Add Module
            </button>
          </div>

          <div className="courseModulesList">
            {selectedCourse.modules.map((module) => (
              <article key={module.id} className="courseModuleCard">
                <header>
                  <h4>{module.title}</h4>
                  <button type="button" onClick={() => handleDeleteModule(module.id)}>Delete Module</button>
                </header>

                {module.materials.length === 0 ? (
                  <p className="courseEmptyModuleText">No materials uploaded in this module yet.</p>
                ) : (
                  module.materials.map((material) => (
                    <div key={material.id} className="courseMaterialRow">
                      <div>
                        <strong>{material.title}</strong>
                        <p>{material.type.toUpperCase()}</p>
                        {material.fileName && <small>File: {material.fileName}</small>}
                      </div>
                      <div className="courseMaterialActions">
                        <button type="button" onClick={() => toggleMaterialDelivered(module.id, material.id)}>
                          {material.isDelivered ? 'Mark Pending' : 'Mark Delivered'}
                        </button>
                        <button type="button" onClick={() => deleteMaterial(module.id, material.id)}>
                          Delete
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </article>
            ))}
          </div>

          <div className="courseUploadBox">
            <h4>Upload Course Material</h4>
            <div className="authForm">
              <label htmlFor="material-module">Select Module</label>
              <select
                id="material-module"
                name="moduleId"
                value={materialForm.moduleId}
                onChange={handleMaterialFormChange}
              >
                <option value="">Select module</option>
                {selectedCourse.modules.map((module) => (
                  <option key={module.id} value={module.id}>
                    {module.title}
                  </option>
                ))}
              </select>

              <label htmlFor="material-title">Material Title</label>
              <input
                id="material-title"
                name="title"
                value={materialForm.title}
                onChange={handleMaterialFormChange}
                placeholder="Lecture 1, Quiz 1, Assignment 1..."
              />

              <label htmlFor="material-type">Material Type</label>
              <select
                id="material-type"
                name="type"
                value={materialForm.type}
                onChange={handleMaterialFormChange}
              >
                <option value="video">Video lecture</option>
                <option value="pdf">PDF / document</option>
                <option value="quiz">Quiz</option>
                <option value="assignment">Assignment</option>
              </select>

              <label htmlFor="material-link">Resource Link (optional)</label>
              <input
                id="material-link"
                name="link"
                value={materialForm.link}
                onChange={handleMaterialFormChange}
                placeholder="https://..."
              />

              <label htmlFor="material-file">Upload File (optional)</label>
              <input id="material-file" type="file" onChange={handleMaterialFileChange} />
            </div>

            <div className="profileModalActions">
              <button type="button" className="profilePrimaryButton" onClick={handleUploadMaterial}>
                Upload Material
              </button>
            </div>
          </div>
        </section>
      )}

      {isModalOpen && (
        <div className="lightboxOverlay" role="dialog" aria-modal="true">
          <div className="lightboxCard">
            <h3>{editingCourseId ? 'Edit course' : 'Create course'}</h3>
            <div className="authForm">
              <label htmlFor="course-title">Course title</label>
              <input id="course-title" name="title" value={courseForm.title} onChange={handleFormChange} />

              <label htmlFor="course-subtitle">Term / subtitle</label>
              <input
                id="course-subtitle"
                name="subtitle"
                value={courseForm.subtitle}
                onChange={handleFormChange}
              />

              <label htmlFor="course-category">Category</label>
              <input
                id="course-category"
                name="category"
                value={courseForm.category}
                onChange={handleFormChange}
                placeholder="AI, Robotics, Computer Science..."
              />

              <label htmlFor="course-description">Description</label>
              <textarea
                id="course-description"
                name="description"
                value={courseForm.description}
                onChange={handleFormChange}
                rows={3}
                placeholder="Write short course description..."
              />

              <label htmlFor="course-instructor">Instructor</label>
              <input id="course-instructor" value={courseForm.instructor} readOnly />
            </div>
            <div className="profileModalActions">
              <button type="button" className="profilePrimaryButton" onClick={handleSaveCourse}>
                Save
              </button>
              <button type="button" className="heroButton heroButtonSecondary" onClick={() => setIsModalOpen(false)}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {deletingCourseId && (
        <div className="lightboxOverlay" role="alertdialog" aria-modal="true" aria-labelledby="course-delete-title">
          <div className="lightboxCard courseDeleteCard">
            <h3 id="course-delete-title">Delete Course</h3>
            <p>
              Are you sure you want to delete this course? 
            </p>
            <div className="profileModalActions">
              <button type="button" className="profileDangerButton" onClick={confirmDeleteCourse}>
                Yes, Delete
              </button>
              <button
                type="button"
                className="heroButton heroButtonSecondary"
                onClick={() => setDeletingCourseId(null)}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
