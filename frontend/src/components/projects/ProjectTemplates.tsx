import React, { useState } from 'react';
import {
  Box,
  Card,
  CardContent,
  CardActions,
  Typography,
  Button,
  Grid,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Divider,
  IconButton,
  Tooltip,
  Paper,
  Alert,
} from '@mui/material';
import {
  Add,
  Schedule,
  Assignment,
  Web,
  Phone,
  Business,
  Code,
  Design,
  Campaign,
  Preview,
  Edit,
  Delete,
} from '@mui/icons-material';
import { ProjectTemplate, Task } from '../../types/project';
import { projectService } from '../../services/api';

interface ProjectTemplatesProps {
  onTemplateSelect?: (template: ProjectTemplate) => void;
  onCreateProject?: (projectData: any) => void;
}

const ProjectTemplates: React.FC<ProjectTemplatesProps> = ({
  onTemplateSelect,
  onCreateProject,
}) => {
  const [selectedTemplate, setSelectedTemplate] = useState<ProjectTemplate | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [projectName, setProjectName] = useState('');
  const [projectDescription, setProjectDescription] = useState('');

  // Predefined templates
  const templates: ProjectTemplate[] = [
    {
      id: 'web-development',
      name: 'Web Development Project',
      description: 'Complete web application development with modern tech stack',
      category: 'Development',
      estimatedDuration: 60, // days
      tasks: [
        {
          title: 'Project Planning & Requirements',
          description: 'Define project scope, requirements, and technical specifications',
          status: 'todo',
          priority: 'high',
          due_date: '',
          estimated_hours: 16,
          actual_hours: 0,
        },
        {
          title: 'UI/UX Design',
          description: 'Create wireframes, mockups, and user interface designs',
          status: 'todo',
          priority: 'high',
          due_date: '',
          estimated_hours: 24,
          actual_hours: 0,
        },
        {
          title: 'Frontend Development',
          description: 'Implement user interface using React/Vue/Angular',
          status: 'todo',
          priority: 'medium',
          due_date: '',
          estimated_hours: 80,
          actual_hours: 0,
        },
        {
          title: 'Backend Development',
          description: 'Develop API endpoints and server-side logic',
          status: 'todo',
          priority: 'medium',
          due_date: '',
          estimated_hours: 60,
          actual_hours: 0,
        },
        {
          title: 'Database Design & Implementation',
          description: 'Design and implement database schema',
          status: 'todo',
          priority: 'medium',
          due_date: '',
          estimated_hours: 20,
          actual_hours: 0,
        },
        {
          title: 'Testing & Quality Assurance',
          description: 'Unit testing, integration testing, and bug fixes',
          status: 'todo',
          priority: 'high',
          due_date: '',
          estimated_hours: 32,
          actual_hours: 0,
        },
        {
          title: 'Deployment & Launch',
          description: 'Deploy to production and launch the application',
          status: 'todo',
          priority: 'high',
          due_date: '',
          estimated_hours: 16,
          actual_hours: 0,
        },
      ],
    },
    {
      id: 'mobile-app',
      name: 'Mobile App Development',
      description: 'Cross-platform mobile application development',
      category: 'Development',
      estimatedDuration: 45,
      tasks: [
        {
          title: 'App Concept & Planning',
          description: 'Define app concept, target audience, and feature set',
          status: 'todo',
          priority: 'high',
          due_date: '',
          estimated_hours: 12,
          actual_hours: 0,
        },
        {
          title: 'UI/UX Design for Mobile',
          description: 'Create mobile-specific designs and user flows',
          status: 'todo',
          priority: 'high',
          due_date: '',
          estimated_hours: 20,
          actual_hours: 0,
        },
        {
          title: 'Cross-Platform Development',
          description: 'Develop app using React Native/Flutter',
          status: 'todo',
          priority: 'medium',
          due_date: '',
          estimated_hours: 100,
          actual_hours: 0,
        },
        {
          title: 'API Integration',
          description: 'Integrate with backend APIs and third-party services',
          status: 'todo',
          priority: 'medium',
          due_date: '',
          estimated_hours: 24,
          actual_hours: 0,
        },
        {
          title: 'Testing on Devices',
          description: 'Test app on various devices and screen sizes',
          status: 'todo',
          priority: 'high',
          due_date: '',
          estimated_hours: 20,
          actual_hours: 0,
        },
        {
          title: 'App Store Submission',
          description: 'Prepare and submit app to App Store and Play Store',
          status: 'todo',
          priority: 'high',
          due_date: '',
          estimated_hours: 8,
          actual_hours: 0,
        },
      ],
    },
    {
      id: 'branding-project',
      name: 'Brand Identity Project',
      description: 'Complete brand identity design and development',
      category: 'Design',
      estimatedDuration: 30,
      tasks: [
        {
          title: 'Brand Research & Strategy',
          description: 'Research target market and define brand strategy',
          status: 'todo',
          priority: 'high',
          due_date: '',
          estimated_hours: 16,
          actual_hours: 0,
        },
        {
          title: 'Logo Design',
          description: 'Create logo concepts and finalize design',
          status: 'todo',
          priority: 'high',
          due_date: '',
          estimated_hours: 24,
          actual_hours: 0,
        },
        {
          title: 'Color Palette & Typography',
          description: 'Define brand colors and typography system',
          status: 'todo',
          priority: 'medium',
          due_date: '',
          estimated_hours: 12,
          actual_hours: 0,
        },
        {
          title: 'Brand Guidelines',
          description: 'Create comprehensive brand guidelines document',
          status: 'todo',
          priority: 'medium',
          due_date: '',
          estimated_hours: 16,
          actual_hours: 0,
        },
        {
          title: 'Marketing Materials',
          description: 'Design business cards, letterhead, and marketing collateral',
          status: 'todo',
          priority: 'low',
          due_date: '',
          estimated_hours: 20,
          actual_hours: 0,
        },
      ],
    },
    {
      id: 'marketing-campaign',
      name: 'Digital Marketing Campaign',
      description: 'Comprehensive digital marketing campaign setup and execution',
      category: 'Marketing',
      estimatedDuration: 21,
      tasks: [
        {
          title: 'Campaign Strategy & Planning',
          description: 'Define campaign objectives, target audience, and strategy',
          status: 'todo',
          priority: 'high',
          due_date: '',
          estimated_hours: 12,
          actual_hours: 0,
        },
        {
          title: 'Content Creation',
          description: 'Create blog posts, social media content, and ad copy',
          status: 'todo',
          priority: 'medium',
          due_date: '',
          estimated_hours: 32,
          actual_hours: 0,
        },
        {
          title: 'Social Media Setup',
          description: 'Set up and optimize social media profiles',
          status: 'todo',
          priority: 'medium',
          due_date: '',
          estimated_hours: 8,
          actual_hours: 0,
        },
        {
          title: 'Ad Campaign Setup',
          description: 'Create and configure Google Ads and Facebook Ads',
          status: 'todo',
          priority: 'high',
          due_date: '',
          estimated_hours: 16,
          actual_hours: 0,
        },
        {
          title: 'Analytics & Reporting',
          description: 'Set up tracking and create performance reports',
          status: 'todo',
          priority: 'medium',
          due_date: '',
          estimated_hours: 12,
          actual_hours: 0,
        },
      ],
    },
  ];

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'Development': return <Code />;
      case 'Design': return <Design />;
      case 'Marketing': return <Campaign />;
      default: return <Business />;
    }
  };

  const getCategoryColor = (category: string) => {
    switch (category) {
      case 'Development': return 'primary';
      case 'Design': return 'secondary';
      case 'Marketing': return 'success';
      default: return 'default';
    }
  };

  const handlePreview = (template: ProjectTemplate) => {
    setSelectedTemplate(template);
    setPreviewOpen(true);
  };

  const handleUseTemplate = (template: ProjectTemplate) => {
    setSelectedTemplate(template);
    setProjectName(template.name);
    setProjectDescription(template.description);
    setCreateDialogOpen(true);
  };

  const handleCreateProject = async () => {
    if (!selectedTemplate || !projectName.trim()) return;

    const projectData = {
      name: projectName,
      description: projectDescription,
      template_id: selectedTemplate.id,
      estimated_duration: selectedTemplate.estimatedDuration,
      tasks: selectedTemplate.tasks,
    };

    try {
      onCreateProject?.(projectData);
      setCreateDialogOpen(false);
      setProjectName('');
      setProjectDescription('');
      setSelectedTemplate(null);
    } catch (error) {
      console.error('Failed to create project from template:', error);
    }
  };

  const totalHours = (tasks: Omit<Task, 'id' | 'project_id' | 'created_at' | 'updated_at'>[]) => {
    return tasks.reduce((sum, task) => sum + task.estimated_hours, 0);
  };

  return (
    <Box>
      <Box sx={{ mb: 3 }}>
        <Typography variant="h5" component="h2" gutterBottom>
          Project Templates
        </Typography>
        <Typography variant="body1" color="text.secondary">
          Choose from pre-built templates to quickly start your project with predefined tasks and timelines.
        </Typography>
      </Box>

      <Grid container spacing={3}>
        {templates.map((template) => (
          <Grid item xs={12} sm={6} md={4} key={template.id}>
            <Card sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
              <CardContent sx={{ flexGrow: 1 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                  {getCategoryIcon(template.category)}
                  <Typography variant="h6" component="h3" sx={{ ml: 1 }}>
                    {template.name}
                  </Typography>
                </Box>
                
                <Typography variant="body2" color="text.secondary" paragraph>
                  {template.description}
                </Typography>
                
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mb: 2 }}>
                  <Chip
                    label={template.category}
                    color={getCategoryColor(template.category) as any}
                    size="small"
                  />
                  <Chip
                    icon={<Schedule />}
                    label={`${template.estimatedDuration} days`}
                    size="small"
                    variant="outlined"
                  />
                  <Chip
                    icon={<Assignment />}
                    label={`${template.tasks.length} tasks`}
                    size="small"
                    variant="outlined"
                  />
                </Box>
                
                <Typography variant="body2" color="text.secondary">
                  Estimated: {totalHours(template.tasks)} hours
                </Typography>
              </CardContent>
              
              <CardActions>
                <Button
                  size="small"
                  startIcon={<Preview />}
                  onClick={() => handlePreview(template)}
                >
                  Preview
                </Button>
                <Button
                  size="small"
                  variant="contained"
                  startIcon={<Add />}
                  onClick={() => handleUseTemplate(template)}
                >
                  Use Template
                </Button>
              </CardActions>
            </Card>
          </Grid>
        ))}
      </Grid>

      {/* Template Preview Dialog */}
      <Dialog
        open={previewOpen}
        onClose={() => setPreviewOpen(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          {selectedTemplate?.name} - Template Preview
        </DialogTitle>
        <DialogContent>
          {selectedTemplate && (
            <Box>
              <Typography variant="body1" paragraph>
                {selectedTemplate.description}
              </Typography>
              
              <Box sx={{ display: 'flex', gap: 2, mb: 3 }}>
                <Chip
                  label={selectedTemplate.category}
                  color={getCategoryColor(selectedTemplate.category) as any}
                />
                <Chip
                  icon={<Schedule />}
                  label={`${selectedTemplate.estimatedDuration} days`}
                  variant="outlined"
                />
                <Chip
                  icon={<Assignment />}
                  label={`${selectedTemplate.tasks.length} tasks`}
                  variant="outlined"
                />
              </Box>
              
              <Typography variant="h6" gutterBottom>
                Included Tasks:
              </Typography>
              
              <Paper variant="outlined">
                <List>
                  {selectedTemplate.tasks.map((task, index) => (
                    <React.Fragment key={index}>
                      <ListItem>
                        <ListItemIcon>
                          <Assignment />
                        </ListItemIcon>
                        <ListItemText
                          primary={task.title}
                          secondary={
                            <Box>
                              <Typography variant="body2" color="text.secondary">
                                {task.description}
                              </Typography>
                              <Box sx={{ display: 'flex', gap: 1, mt: 1 }}>
                                <Chip
                                  label={task.priority}
                                  size="small"
                                  color={
                                    task.priority === 'high' ? 'error' :
                                    task.priority === 'medium' ? 'warning' : 'success'
                                  }
                                />
                                <Chip
                                  label={`${task.estimated_hours}h`}
                                  size="small"
                                  variant="outlined"
                                />
                              </Box>
                            </Box>
                          }
                        />
                      </ListItem>
                      {index < selectedTemplate.tasks.length - 1 && <Divider />}
                    </React.Fragment>
                  ))}
                </List>
              </Paper>
              
              <Alert severity="info" sx={{ mt: 2 }}>
                Total estimated time: {totalHours(selectedTemplate.tasks)} hours
              </Alert>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setPreviewOpen(false)}>
            Close
          </Button>
          <Button
            variant="contained"
            onClick={() => {
              setPreviewOpen(false);
              handleUseTemplate(selectedTemplate!);
            }}
          >
            Use This Template
          </Button>
        </DialogActions>
      </Dialog>

      {/* Create Project Dialog */}
      <Dialog
        open={createDialogOpen}
        onClose={() => setCreateDialogOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>
          Create Project from Template
        </DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
            <TextField
              fullWidth
              label="Project Name"
              value={projectName}
              onChange={(e) => setProjectName(e.target.value)}
              required
            />
            <TextField
              fullWidth
              multiline
              rows={3}
              label="Project Description"
              value={projectDescription}
              onChange={(e) => setProjectDescription(e.target.value)}
            />
            
            {selectedTemplate && (
              <Alert severity="info">
                This will create a project with {selectedTemplate.tasks.length} predefined tasks 
                and an estimated duration of {selectedTemplate.estimatedDuration} days.
              </Alert>
            )}
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCreateDialogOpen(false)}>
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={handleCreateProject}
            disabled={!projectName.trim()}
          >
            Create Project
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default ProjectTemplates;