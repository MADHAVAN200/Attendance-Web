
import { attendanceDB } from '../config/database.js';

// Helper to safely parse JSON strings from database
const safeParseJSON = (data, fallback = []) => {
  if (!data) return fallback;
  if (typeof data === 'object') return data;
  try {
    return JSON.parse(data);
  } catch (e) {
    console.error('JSON Parse error:', e);
    return fallback;
  }
};

// Helper to safely serialize objects to JSON strings
const safeStringifyJSON = (data) => {
  if (!data) return null;
  return typeof data === 'string' ? data : JSON.stringify(data);
};

// ─── JOB OPENINGS ─────────────────────────────────────────────────────────────

// Get openings scoped to organization
export const getOpenings = async (req, res) => {
  try {
    const orgId = req.user.org_id;
    const openings = await attendanceDB('recruitment_openings')
      .where({ org_id: orgId })
      .orderBy('created_at', 'desc');

    const formattedOpenings = openings.map(j => ({
      ...j,
      skills_required: j.skills_required ? j.skills_required.split(', ') : [],
      form_config: safeParseJSON(j.form_config, [])
    }));

    res.json(formattedOpenings);
  } catch (error) {
    console.error('Error fetching openings:', error);
    res.status(500).json({ error: 'Failed to fetch job openings.' });
  }
};

// Create a new job opening
export const createOpening = async (req, res) => {
  try {
    const orgId = req.user.org_id;
    const createdBy = req.user.user_id || null;
    const {
      job_title,
      department,
      location,
      employment_type,
      experience_required,
      salary_range,
      skills_required,
      responsibilities,
      benefits,
      deadline,
      form_config,
      template_id,
      template_source
    } = req.body;

    if (!job_title || !department || !location || !deadline) {
      return res.status(400).json({ error: 'Missing required job opening fields.' });
    }

    // Generate unique slug
    const cleanTitle = job_title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
    const code = Math.floor(100 + Math.random() * 900);
    const slug = `${cleanTitle}-${code}`;

    const [insertedId] = await attendanceDB('recruitment_openings').insert({
      org_id: orgId,
      job_title,
      slug,
      department,
      location,
      employment_type: employment_type || 'Full-time',
      experience_required,
      salary_range,
      skills_required: Array.isArray(skills_required) ? skills_required.join(', ') : skills_required,
      responsibilities,
      benefits,
      deadline,
      status: 'active',
      form_config: safeStringifyJSON(form_config),
      template_id,
      template_source: template_source || 'scratch',
      created_by: createdBy
    });

    res.status(201).json({ message: 'Job opening created successfully!', id: insertedId, slug });
  } catch (error) {
    console.error('Error creating opening:', error);
    res.status(500).json({ error: 'Failed to publish job opening.' });
  }
};

// Toggle job posting status (active/inactive)
export const toggleOpeningStatus = async (req, res) => {
  try {
    const orgId = req.user.org_id;
    const { id } = req.params;
    const { status } = req.body; // expected 'active' or 'inactive'

    if (!['active', 'inactive'].includes(status)) {
      return res.status(400).json({ error: 'Invalid status value.' });
    }

    await attendanceDB('recruitment_openings')
      .where({ id, org_id: orgId })
      .update({ status, updated_at: attendanceDB.fn.now() });

    res.json({ message: `Job status updated to ${status}.` });
  } catch (error) {
    console.error('Error toggling opening status:', error);
    res.status(500).json({ error: 'Failed to update job status.' });
  }
};

// Fetch public job opening details by slug (No auth required)
export const getPublicOpening = async (req, res) => {
  try {
    const { slug } = req.params;
    const opening = await attendanceDB('recruitment_openings')
      .where({ slug })
      .first();

    if (!opening) {
      return res.status(404).json({ error: 'Job opening not found.' });
    }

    const todayStr = new Date().toISOString().split('T')[0];
    const isExpired = opening.deadline && opening.deadline < todayStr;

    res.json({
      ...opening,
      skills_required: opening.skills_required ? opening.skills_required.split(', ') : [],
      form_config: safeParseJSON(opening.form_config, []),
      isExpired
    });
  } catch (error) {
    console.error('Error fetching public opening:', error);
    res.status(500).json({ error: 'Failed to load public career page.' });
  }
};

// ─── PIPELINE CUSTOMIZATION ──────────────────────────────────────────────────

// Fetch customizable stages scoped to organization
export const getPipelineStages = async (req, res) => {
  try {
    const orgId = req.user.org_id;
    const stages = await attendanceDB('recruitment_pipeline_stages')
      .where({ org_id: orgId })
      .orderBy('sort_order', 'asc');

    res.json(stages);
  } catch (error) {
    console.error('Error fetching pipeline stages:', error);
    res.status(500).json({ error: 'Failed to fetch pipeline stages.' });
  }
};

// Save (insert, update, delete, reorder) pipeline stages with candidate migrations
export const savePipelineStages = async (req, res) => {
  const trx = await attendanceDB.transaction();
  try {
    const orgId = req.user.org_id;
    const { stages } = req.body; // Array of { id, name, color, sort_order }

    if (!Array.isArray(stages) || stages.length === 0) {
      return res.status(400).json({ error: 'Stages must be a non-empty array.' });
    }

    // 1. Fetch current database stages before modification to check for deletes/renames
    const currentStages = await trx('recruitment_pipeline_stages')
      .where({ org_id: orgId })
      .orderBy('sort_order', 'asc');

    const firstNewStageName = stages[0].name;

    // 2. Perform candidate status migrations
    for (const oldStage of currentStages) {
      const correspondingNewStage = stages.find(ns => ns.id === oldStage.id);

      if (correspondingNewStage) {
        // If renamed, update candidates in old stage name to new stage name
        if (correspondingNewStage.name !== oldStage.name) {
          await trx('recruitment_candidates')
            .where({ stage: oldStage.name })
            .andWhereExists(function() {
              this.select('*')
                .from('recruitment_openings')
                .whereRaw('recruitment_candidates.job_id = recruitment_openings.id')
                .andWhere('org_id', orgId);
            })
            .update({ stage: correspondingNewStage.name });
        }
      } else {
        // If deleted, migrate candidates in old stage name to the first stage of the updated pipeline
        await trx('recruitment_candidates')
          .where({ stage: oldStage.name })
          .andWhereExists(function() {
            this.select('*')
              .from('recruitment_openings')
              .whereRaw('recruitment_candidates.job_id = recruitment_openings.id')
              .andWhere('org_id', orgId);
          })
          .update({ stage: firstNewStageName });
      }
    }

    // 3. Clear existing stages and bulk insert the new config
    await trx('recruitment_pipeline_stages')
      .where({ org_id: orgId })
      .delete();

    const insertData = stages.map((s, idx) => ({
      id: s.id,
      org_id: orgId,
      name: s.name,
      color: s.color || 'slate',
      sort_order: idx
    }));

    await trx('recruitment_pipeline_stages').insert(insertData);

    await trx.commit();
    res.json({ message: 'Recruitment pipeline stages customized successfully!' });
  } catch (error) {
    await trx.rollback();
    console.error('Error saving pipeline stages:', error);
    res.status(500).json({ error: 'Failed to customize recruitment pipeline.' });
  }
};

// ─── FORM BUILDER TEMPLATES ─────────────────────────────────────────────────

// Fetch form templates (combines predefined global and custom admin templates)
export const getTemplates = async (req, res) => {
  try {
    const orgId = req.user.org_id;
    const templates = await attendanceDB('recruitment_form_templates')
      .where({ org_id: orgId })
      .orWhereNull('org_id') // Get system-wide predefined templates
      .orderBy('created_at', 'desc');

    const formattedTemplates = templates.map(t => ({
      ...t,
      fields: safeParseJSON(t.fields, [])
    }));

    res.json(formattedTemplates);
  } catch (error) {
    console.error('Error fetching templates:', error);
    res.status(500).json({ error: 'Failed to fetch form templates.' });
  }
};

// Save a new form template
export const saveTemplate = async (req, res) => {
  try {
    const orgId = req.user.org_id;
    const { name, description, fields } = req.body;

    if (!name || !fields) {
      return res.status(400).json({ error: 'Missing template name or fields schema.' });
    }

    const templateId = 'tpl_' + Date.now();

    await attendanceDB('recruitment_form_templates').insert({
      id: templateId,
      org_id: orgId,
      name,
      description: description || null,
      fields: safeStringifyJSON(fields)
    });

    res.status(201).json({ message: 'Template saved successfully!', id: templateId });
  } catch (error) {
    console.error('Error saving template:', error);
    res.status(500).json({ error: 'Failed to save template.' });
  }
};

// Delete a custom template
export const deleteTemplate = async (req, res) => {
  try {
    const orgId = req.user.org_id;
    const { id } = req.params;

    // Prevent deletion of system predefined templates (which have org_id as null)
    const affected = await attendanceDB('recruitment_form_templates')
      .where({ id, org_id: orgId })
      .delete();

    if (!affected) {
      return res.status(404).json({ error: 'Template not found or cannot be deleted.' });
    }

    res.json({ message: 'Template deleted successfully.' });
  } catch (error) {
    console.error('Error deleting template:', error);
    res.status(500).json({ error: 'Failed to delete template.' });
  }
};

// ─── CANDIDATES & APPLICATIONS ───────────────────────────────────────────────

// Get candidates applying to active jobs of an organization
export const getCandidatesForJob = async (req, res) => {
  try {
    const orgId = req.user.org_id;
    const candidates = await attendanceDB('recruitment_candidates')
      .join('recruitment_openings', 'recruitment_candidates.job_id', '=', 'recruitment_openings.id')
      .where('recruitment_openings.org_id', orgId)
      .select('recruitment_candidates.*', 'recruitment_openings.job_title', 'recruitment_openings.department')
      .orderBy('recruitment_candidates.created_at', 'desc');

    const formatted = candidates.map(c => ({
      ...c,
      form_responses: safeParseJSON(c.form_responses, {}),
      ai_strengths: safeParseJSON(c.ai_strengths, []),
      ai_weaknesses: safeParseJSON(c.ai_weaknesses, []),
      extracted_skills: safeParseJSON(c.extracted_skills, []),
      // Map name/email dynamically from the response JSON for presentation
      full_name: c.form_responses.full_name || c.form_responses['Full Name'] || 'Candidate ' + c.id,
      email: c.form_responses.email || c.form_responses['Email Address'] || 'N/A',
      mobile: c.form_responses.mobile || c.form_responses['Mobile Number'] || 'N/A',
      resume_name: c.form_responses.resume_name || c.form_responses['Resume File'] || 'resume.pdf'
    }));

    res.json(formatted);
  } catch (error) {
    console.error('Error fetching candidates:', error);
    res.status(500).json({ error: 'Failed to fetch candidate profiles.' });
  }
};

// Update candidate stage in Kanban board
export const updateCandidateStage = async (req, res) => {
  try {
    const orgId = req.user.org_id;
    const { id } = req.params;
    const { stage } = req.body;

    // Verify candidate belongs to active organization before updating
    const candidate = await attendanceDB('recruitment_candidates')
      .join('recruitment_openings', 'recruitment_candidates.job_id', '=', 'recruitment_openings.id')
      .where('recruitment_candidates.id', id)
      .andWhere('recruitment_openings.org_id', orgId)
      .first();

    if (!candidate) {
      return res.status(404).json({ error: 'Candidate profile not found.' });
    }

    await attendanceDB('recruitment_candidates')
      .where({ id })
      .update({ stage });

    res.json({ message: `Candidate moved to stage: ${stage}` });
  } catch (error) {
    console.error('Error moving candidate stage:', error);
    res.status(500).json({ error: 'Failed to update candidate pipeline stage.' });
  }
};

// Submit dynamic candidate application (Public Endpoint)
export const applyForJob = async (req, res) => {
  try {
    const { jobId } = req.params;
    const { responses, template_id, template_source } = req.body; // expected raw stringified JSON form values

    const parsedResponses = typeof responses === 'string' ? JSON.parse(responses) : responses;

    const opening = await attendanceDB('recruitment_openings')
      .where({ id: jobId })
      .first();

    if (!opening || opening.status !== 'active') {
      return res.status(404).json({ error: 'Job opening is closed or deactivated.' });
    }

    // Capture uploaded resume from Multer (mock upload path)
    const resumeName = req.file ? req.file.originalname : 'resume.pdf';
    const resumeUrl = `/uploads/resumes/${Date.now()}_${resumeName}`;

    // Inject file details into the dynamic form response values
    const fullFormResponses = {
      ...parsedResponses,
      resume_name: resumeName,
      resume_url: resumeUrl
    };

    // Calculate AI matches and scores on the backend
    const fullName = parsedResponses.full_name || parsedResponses['Full Name'] || 'Candidate';
    const email = parsedResponses.email || parsedResponses['Email Address'] || 'N/A';
    const aiResults = calculateCandidateScores(fullName, email, fullFormResponses, resumeName);

    // Fetch dynamic pipeline stages to assign candidate to the first stage
    const pipelineStages = await attendanceDB('recruitment_pipeline_stages')
      .where({ org_id: opening.org_id })
      .orderBy('sort_order', 'asc');

    const firstStageName = pipelineStages.length > 0 ? pipelineStages[0].name : 'Applied';

    const [candId] = await attendanceDB('recruitment_candidates').insert({
      job_id: jobId,
      template_id: template_id || opening.template_id || null,
      template_source: template_source || opening.template_source || 'scratch',
      stage: firstStageName,
      form_responses: safeStringifyJSON(fullFormResponses),
      ai_score: aiResults.ai_score,
      skill_match_score: aiResults.skill_match_score,
      experience_match_score: aiResults.experience_match_score,
      education_match_score: aiResults.education_match_score,
      culture_fit_score: aiResults.culture_fit_score,
      ai_strengths: safeStringifyJSON(aiResults.ai_strengths),
      ai_weaknesses: safeStringifyJSON(aiResults.ai_weaknesses),
      ai_recommendation: aiResults.ai_recommendation,
      extracted_skills: safeStringifyJSON(aiResults.extracted_skills),
      total_experience: aiResults.total_experience,
      relevant_experience: aiResults.relevant_experience,
      education: aiResults.education,
      certifications: aiResults.certifications,
      projects: aiResults.projects,
      achievements: aiResults.achievements
    });

    res.status(201).json({ message: 'Application submitted successfully!', id: candId });
  } catch (error) {
    console.error('Error submitting application:', error);
    res.status(500).json({ error: 'Failed to submit candidate application.' });
  }
};

// ─── Backend AI Scoring Simulation ───────────────────────────────────────────
const calculateCandidateScores = (fullName, email, responses, resumeName) => {
  const textContent = JSON.stringify(responses).toLowerCase();
  
  let skillMatch = 70;
  let experienceMatch = 72;
  let educationMatch = 75;
  let cultureFit = 80;

  const strengths = [];
  const weaknesses = [];

  // Match keyword patterns
  if (textContent.includes('react') || textContent.includes('vue') || textContent.includes('angular')) {
    skillMatch += 15;
    strengths.push('Excellent profile scoring with professional frontend experience indicators');
  }
  if (textContent.includes('node') || textContent.includes('express') || textContent.includes('django') || textContent.includes('python')) {
    skillMatch += 10;
    strengths.push('Experienced in structured Knex queries and MySQL scaling');
  }
  if (textContent.includes('aws') || textContent.includes('docker') || textContent.includes('redis')) {
    skillMatch += 5;
    strengths.push('Familiar with Redis caches and cloud deployments');
  }

  // Notice period scoring
  const notice = String(responses.notice_period || responses['Notice Period'] || '').toLowerCase();
  if (notice.includes('immediate')) {
    cultureFit += 15;
    strengths.push('Available to join immediately');
  } else if (notice.includes('90 days') || notice.includes('3 months') || notice.includes('60 days')) {
    cultureFit -= 10;
    weaknesses.push('Notice period represents a long onboarding delay');
  }

  skillMatch = Math.min(100, Math.max(0, skillMatch));
  experienceMatch = Math.min(100, Math.max(0, experienceMatch));
  educationMatch = Math.min(100, Math.max(0, educationMatch));
  cultureFit = Math.min(100, Math.max(0, cultureFit));

  const overall = Math.round((skillMatch * 0.4) + (experienceMatch * 0.3) + (educationMatch * 0.1) + (cultureFit * 0.2));

  let recommendation = 'Recommended';
  if (overall >= 85) {
    recommendation = 'Highly Recommended';
  } else if (overall < 70) {
    recommendation = 'Under Consideration';
  }

  if (strengths.length === 0) strengths.push('Clear details provided on career aspirations');
  if (weaknesses.length === 0) weaknesses.push('None identified from brief resume scanning');

  return {
    ai_score: overall,
    skill_match_score: skillMatch,
    experience_match_score: experienceMatch,
    education_match_score: educationMatch,
    culture_fit_score: cultureFit,
    ai_strengths: strengths,
    ai_weaknesses: weaknesses,
    ai_recommendation: recommendation,
    extracted_skills: ['HTML5', 'CSS3', 'JavaScript', 'React', 'Node.js'],
    total_experience: '3 Years',
    relevant_experience: '2.5 Years',
    education: 'Bachelor of Engineering',
    certifications: 'Agile Methodology Basic Certificate',
    projects: 'Project Dashboard Implementation, Client Portal Interface',
    achievements: 'Optimized rendering flow by 20%'
  };
};
