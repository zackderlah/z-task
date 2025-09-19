class TodoApp {
    constructor() {
        this.projectData = this.loadFromStorage() || this.getDefaultProjects();
        this.currentProjectId = this.getFirstProjectId();
        this.currentEditingItem = null;
        this.currentEditingColumn = null;
        this.currentEditingProject = null;
        this.currentEditingFolder = null;
        this.isDarkTheme = true;
        this.sidebarWidth = 250;
        this.isResizing = false;
        this.isSidebarOpen = true;
        this.currentEditingTask = null;
        this.draggedProject = null;
        this.currentUser = null;
        this.isSignupMode = false;
        this.selectedProjects = new Set();
        this.lastSelectedProject = null;
        this.historyData = this.getHistoryData();
        
        this.initializeEventListeners();
        this.loadUserSession();
        this.cleanupOldCompletedTasks(); // Run cleanup on startup
        this.render();
        
        // Set up periodic cleanup every hour
        setInterval(() => {
            this.cleanupOldCompletedTasks();
        }, 60 * 60 * 1000); // 1 hour
        
        // Debug: Check if auth elements exist
        console.log('Auth elements check:');
        console.log('Login button:', document.getElementById('loginBtn'));
        console.log('Signup button:', document.getElementById('signupBtn'));
        console.log('Auth modal:', document.getElementById('authModal'));
        console.log('showAuthModal method exists:', typeof this.showAuthModal);
    }

    getDefaultProjects() {
        return {
            folders: [
                {
                    id: 'business',
                    name: 'Business',
                    expanded: true,
                    projects: [
                        {
                            id: 'z-task',
                            name: 'z-task',
                            columns: [
                                {
                                    id: 'ui',
                                    title: 'USER INTERFACE',
                                    tag: 'ui',
                                    items: [
                                        { id: 'ui1', text: 'DARK MODE YAPILACAK', completed: false, description: 'Implement dark mode theme for better user experience', dueDate: '2024-01-15', priority: 'high', tags: ['ui', 'theme', 'dark-mode'] },
                                        { id: 'ui2', text: 'RESPONSIVE TASARIM YAPILACAK', completed: false, description: 'Make the application responsive for mobile and tablet devices', dueDate: '2024-01-20', priority: 'medium', tags: ['ui', 'responsive', 'mobile'] },
                                        { id: 'ui3', text: 'ANIMASYONLAR EKLENECEK', completed: false, description: 'Add smooth animations and transitions to improve user experience', dueDate: '', priority: 'low', tags: ['ui', 'animation', 'ux'] }
                                    ]
                                },
                                {
                                    id: 'backend',
                                    title: 'BACKEND',
                                    tag: 'backend',
                                    items: [
                                        { id: 'be1', text: 'API ENDPOINT\'LERİ YAPILACAK', completed: false, description: 'Create REST API endpoints for task management', dueDate: '2024-01-18', priority: 'high', tags: ['backend', 'api', 'rest'] },
                                        { id: 'be2', text: 'VERİTABANI KURULACAK', completed: false, description: 'Set up database schema and connections', dueDate: '2024-01-25', priority: 'high', tags: ['backend', 'database', 'schema'] }
                                    ]
                                },
                                {
                                    id: 'feature',
                                    title: 'FEATURE',
                                    tag: 'feature',
                                    items: [
                                        { id: 'feat1', text: 'PROGRESS BAR YAPILACAK', completed: false, description: 'Implement a progress bar to show completion status of tasks and projects', dueDate: '2024-01-30', priority: 'medium', tags: ['feature', 'progress', 'visual'] },
                                        { id: 'feat2', text: 'KOLON SİLME', completed: false, description: 'Add functionality to delete columns with proper user confirmation and data handling', dueDate: '', priority: 'low', tags: ['feature', 'delete'] },
                                        { id: 'feat3', text: 'GÜNDÜZ MODU YAPILACAK', completed: false, description: 'Create a light theme mode for better visibility during daytime use', dueDate: '2024-01-12', priority: 'high', tags: ['theme', 'accessibility', 'ui'] }
                                    ]
                                }
                            ]
                        }
                    ]
                },
                {
                    id: 'personal',
                    name: 'Personal',
                    expanded: false,
                    projects: []
                }
            ],
            uncategorized: []
        };
    }

    getFirstProjectId() {
        // Find the first project in any folder or uncategorized
        for (const folder of this.projectData.folders || []) {
            if (folder.projects && folder.projects.length > 0) {
                return folder.projects[0].id;
            }
        }
        if (this.projectData.uncategorized && this.projectData.uncategorized.length > 0) {
            return this.projectData.uncategorized[0].id;
        }
        return null;
    }

    getAllProjects() {
        const allProjects = [];
        for (const folder of this.projectData.folders || []) {
            if (folder.projects) {
                allProjects.push(...folder.projects);
            }
        }
        if (this.projectData.uncategorized) {
            allProjects.push(...this.projectData.uncategorized);
        }
        return allProjects;
    }

    getProjectTaskCount(projectId) {
        const allProjects = this.getAllProjects();
        const project = allProjects.find(p => p.id === projectId);
        if (!project) return 0;
        
        let totalTasks = 0;
        let completedTasks = 0;
        
        project.columns.forEach(column => {
            column.items.forEach(item => {
                totalTasks++;
                if (item.completed) {
                    completedTasks++;
                }
            });
        });
        
        return totalTasks - completedTasks; // Return outstanding (incomplete) tasks
    }

    getHistoryData() {
        const stored = localStorage.getItem('todoAppHistory');
        return stored ? JSON.parse(stored) : {};
    }

    saveHistoryData() {
        localStorage.setItem('todoAppHistory', JSON.stringify(this.historyData));
    }

    addToHistory(projectId, task) {
        console.log('Adding task to history:', { projectId, task });
        
        if (!this.historyData[projectId]) {
            this.historyData[projectId] = [];
        }
        
        const historyEntry = {
            id: task.id,
            text: task.text,
            description: task.description || '',
            dueDate: task.dueDate || '',
            priority: task.priority || 'medium',
            tags: task.tags || [],
            completedAt: task.completedAt || new Date().toISOString(),
            createdAt: task.createdAt || new Date().toISOString()
        };
        
        this.historyData[projectId].push(historyEntry);
        this.saveHistoryData();
        
        console.log('History updated:', this.historyData[projectId]);
    }

    cleanupOldCompletedTasks() {
        const now = new Date();
        const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        
        const allProjects = this.getAllProjects();
        allProjects.forEach(project => {
            project.columns.forEach(column => {
                const tasksToRemove = [];
                column.items.forEach(item => {
                    if (item.completed && item.completedAt) {
                        const completedDate = new Date(item.completedAt);
                        if (completedDate < oneDayAgo) {
                            // Add to history before removing
                            this.addToHistory(project.id, item);
                            tasksToRemove.push(item.id);
                        }
                    }
                });
                
                // Remove old completed tasks
                column.items = column.items.filter(item => !tasksToRemove.includes(item.id));
            });
        });
        
        this.saveToStorage();
    }

    getCurrentProject() {
        return this.getAllProjects().find(project => project.id === this.currentProjectId);
    }

    getCurrentColumns() {
        const project = this.getCurrentProject();
        return project ? project.columns : [];
    }

    initializeEventListeners() {
        // Add new button (for adding columns)
        const addNewBtn = document.getElementById('addNewBtn');
        if (addNewBtn) {
            addNewBtn.addEventListener('click', () => {
                this.showAddColumnModal();
            });
        }

        // Add project button
        const addProjectBtn = document.getElementById('addProjectBtn');
        if (addProjectBtn) {
            addProjectBtn.addEventListener('click', () => {
                this.showAddProjectModal();
            });
        }

        // Add folder button
        const addFolderBtn = document.getElementById('addFolderBtn');
        if (addFolderBtn) {
            addFolderBtn.addEventListener('click', () => {
                this.showAddFolderModal();
            });
        }

        // Theme toggle
        document.getElementById('themeBtn').addEventListener('click', () => {
            this.toggleTheme();
        });

        // Invite button
        const inviteBtn = document.getElementById('inviteBtn');
        if (inviteBtn) {
            inviteBtn.addEventListener('click', () => {
                this.showInviteModal();
            });
        }

        // Sidebar toggle
        document.getElementById('sidebarToggle').addEventListener('click', () => {
            this.toggleSidebar();
        });

        // Resize handle
        const resizeHandle = document.getElementById('resizeHandle');
        resizeHandle.addEventListener('mousedown', (e) => {
            this.isResizing = true;
            e.preventDefault();
        });

        // Document events for resizing
        document.addEventListener('mousemove', (e) => {
            if (this.isResizing) {
                const newWidth = e.clientX;
                if (newWidth >= 200 && newWidth <= 400) {
                    this.sidebarWidth = newWidth;
                    this.applySidebarWidth();
                }
            }
        });

        document.addEventListener('mouseup', () => {
            if (this.isResizing) {
                this.isResizing = false;
                this.saveToStorage();
            }
        });

        // Window resize
        window.addEventListener('resize', () => {
            this.handleWindowResize();
        });

        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            // Delete key to delete selected projects
            if (e.key === 'Delete' && this.selectedProjects.size > 0) {
                e.preventDefault();
                this.deleteSelectedProjects();
            }
            // Escape key to clear selection
            if (e.key === 'Escape') {
                this.clearProjectSelection();
            }
        });

        // Task details modal
        document.getElementById('taskDetailsModal').addEventListener('click', (e) => {
            if (e.target.id === 'taskDetailsModal') {
                this.hideTaskDetailsModal();
            }
        });

        // Invitation modal
        document.getElementById('invitationModal').addEventListener('click', (e) => {
            if (e.target.id === 'invitationModal') {
                this.hideInviteModal();
            }
        });

        // History modal
        document.getElementById('closeHistoryModal').addEventListener('click', () => this.hideHistoryModal());
        document.getElementById('closeHistoryBtn').addEventListener('click', () => this.hideHistoryModal());
        
        // History modal click outside
        document.getElementById('historyModal').addEventListener('click', (e) => {
            if (e.target.id === 'historyModal') {
                this.hideHistoryModal();
            }
        });


        // Modal event listeners
        // Add item modal
        document.getElementById('closeModal').addEventListener('click', () => this.hideAddModal());
        document.getElementById('saveItem').addEventListener('click', () => this.addItem());
        document.getElementById('cancelItem').addEventListener('click', () => this.hideAddModal());
        
        // Add Enter key support to item input
        const itemInput = document.getElementById('itemInput');
        if (itemInput) {
            itemInput.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    this.addItem();
                }
            });
        }

        // Add column modal
        document.getElementById('closeColumnModal').addEventListener('click', () => this.hideAddColumnModal());
        document.getElementById('saveColumn').addEventListener('click', () => this.addColumn());
        document.getElementById('cancelColumn').addEventListener('click', () => this.hideAddColumnModal());
        
        // Add Enter key support to column inputs
        const columnInput = document.getElementById('columnInput');
        const columnTagInput = document.getElementById('columnTagInput');
        
        if (columnInput) {
            columnInput.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    this.addColumn();
                }
            });
        }
        
        if (columnTagInput) {
            columnTagInput.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    this.addColumn();
                }
            });
        }

        // Add project modal
        document.getElementById('closeProjectModal').addEventListener('click', () => this.hideAddProjectModal());
        document.getElementById('saveProject').addEventListener('click', () => this.addProject());
        document.getElementById('cancelProject').addEventListener('click', () => this.hideAddProjectModal());
        
        // Add Enter key support to project input
        const projectInput = document.getElementById('projectInput');
        if (projectInput) {
            projectInput.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    this.addProject();
                }
            });
        }

        // Task details modal
        document.getElementById('closeTaskDetailsModal').addEventListener('click', () => this.hideTaskDetailsModal());
        document.getElementById('saveTaskDetails').addEventListener('click', () => this.saveTaskDetails());
        document.getElementById('cancelTaskDetails').addEventListener('click', () => this.hideTaskDetailsModal());
        
        // Add Enter key support to task detail inputs
        this.initializeTaskDetailsEnterKey();

        // Invitation modal event listeners
        const closeInvitationModal = document.getElementById('closeInvitationModal');
        const sendInviteBtn = document.getElementById('sendInviteBtn');
        const cancelInviteBtn = document.getElementById('cancelInviteBtn');
        const inviteEmailInput = document.getElementById('inviteEmailInput');

        if (closeInvitationModal) {
            closeInvitationModal.addEventListener('click', () => this.hideInviteModal());
        }

        if (sendInviteBtn) {
            sendInviteBtn.addEventListener('click', () => this.sendInvitation());
        }

        if (cancelInviteBtn) {
            cancelInviteBtn.addEventListener('click', () => this.hideInviteModal());
        }

        if (inviteEmailInput) {
            inviteEmailInput.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    this.sendInvitation();
                }
            });
        }

        // Authentication event listeners
        const loginBtn = document.getElementById('loginBtn');
        const signupBtn = document.getElementById('signupBtn');
        const logoutBtn = document.getElementById('logoutBtn');
        const closeAuthModal = document.getElementById('closeAuthModal');
        const authCancelBtn = document.getElementById('authCancelBtn');
        const authSwitchBtn = document.getElementById('authSwitchBtn');
        const authForm = document.getElementById('authForm');

        if (loginBtn) {
            loginBtn.addEventListener('click', () => {
                console.log('Login button clicked');
                this.showAuthModal(false);
            });
        } else {
            console.error('Login button not found');
        }

        if (signupBtn) {
            signupBtn.addEventListener('click', () => {
                console.log('Signup button clicked');
                this.showAuthModal(true);
            });
        } else {
            console.error('Signup button not found');
        }

        if (logoutBtn) {
            logoutBtn.addEventListener('click', () => this.logout());
        }

        if (closeAuthModal) {
            closeAuthModal.addEventListener('click', () => this.hideAuthModal());
        }

        if (authCancelBtn) {
            authCancelBtn.addEventListener('click', () => this.hideAuthModal());
        }

        if (authSwitchBtn) {
            authSwitchBtn.addEventListener('click', () => this.toggleAuthMode());
        }

        if (authForm) {
            authForm.addEventListener('submit', (e) => this.handleAuthSubmit(e));
        }

        // Add Enter key support to auth form inputs
        const emailInput = document.getElementById('emailInput');
        const passwordInput = document.getElementById('passwordInput');
        const userNameInput = document.getElementById('userNameInput');
        const confirmPasswordInput = document.getElementById('confirmPasswordInput');

        if (emailInput) {
            emailInput.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    this.handleAuthSubmit(e);
                }
            });
        }

        if (passwordInput) {
            passwordInput.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    this.handleAuthSubmit(e);
                }
            });
        }

        if (userNameInput) {
            userNameInput.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    this.handleAuthSubmit(e);
                }
            });
        }

        if (confirmPasswordInput) {
            confirmPasswordInput.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    this.handleAuthSubmit(e);
                }
            });
        }

        this.initializeResizeEvents();
    }

    initializeResizeEvents() {
        // Handle window resize for responsive behavior
        window.addEventListener('resize', () => {
            this.handleWindowResize();
        });
    }

    initializeTaskDetailsEnterKey() {
        // Add Enter key support to task detail inputs
        const taskTitle = document.getElementById('taskTitle');
        const taskDescription = document.getElementById('taskDescription');
        const taskDueDate = document.getElementById('taskDueDate');
        const taskPriority = document.getElementById('taskPriority');
        const taskTags = document.getElementById('taskTags');

        const handleEnterKey = (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                this.saveTaskDetails();
            }
        };

        if (taskTitle) {
            taskTitle.addEventListener('keydown', handleEnterKey);
        }
        if (taskDescription) {
            taskDescription.addEventListener('keydown', handleEnterKey);
        }
        if (taskDueDate) {
            taskDueDate.addEventListener('keydown', handleEnterKey);
        }
        if (taskPriority) {
            taskPriority.addEventListener('keydown', handleEnterKey);
        }
        if (taskTags) {
            taskTags.addEventListener('keydown', handleEnterKey);
        }
    }

    toggleSidebar() {
        const sidebar = document.getElementById('sidebar');
        sidebar.classList.toggle('open');
        this.isSidebarOpen = sidebar.classList.contains('open');
        this.saveToStorage();
    }

    handleWindowResize() {
        const sidebar = document.getElementById('sidebar');
        if (window.innerWidth <= 768) {
            // Mobile: hide sidebar by default
            sidebar.classList.remove('open');
            this.isSidebarOpen = false;
        } else {
            // Desktop: show sidebar and apply saved width
            sidebar.classList.add('open');
            this.isSidebarOpen = true;
            this.applySidebarWidth();
        }
    }

    applySidebarWidth() {
        const sidebar = document.getElementById('sidebar');
        if (sidebar && window.innerWidth > 768) {
            sidebar.style.width = `${this.sidebarWidth}px`;
        }
    }

    renderProjects() {
        // Only render projects if user is authenticated
        if (!this.currentUser) {
            return;
        }
        
        const container = document.getElementById('projectsList');
        if (!container) {
            return;
        }
        container.innerHTML = '';

        // Render folders
        this.projectData.folders.forEach(folder => {
            const folderElement = this.createFolderElement(folder);
            container.appendChild(folderElement);
        });

        // Render uncategorized projects
        if (this.projectData.uncategorized.length > 0) {
            const uncategorizedElement = this.createUncategorizedElement();
            container.appendChild(uncategorizedElement);
        }
    }

    createFolderElement(folder) {
        const folderDiv = document.createElement('div');
        folderDiv.className = 'folder-item';
        folderDiv.dataset.folderId = folder.id;

        const projectsHtml = folder.projects.map(project => {
            const isActive = project.id === this.currentProjectId;
            const isSelected = this.selectedProjects.has(project.id);
            const taskCount = this.getProjectTaskCount(project.id);
            return `
                <div class="project-item ${isActive ? 'active' : ''} ${isSelected ? 'selected' : ''}" 
                     data-project-id="${project.id}"
                     draggable="true"
                     ondragstart="todoApp.handleDragStart(event, '${project.id}')"
                     ondragend="todoApp.handleDragEnd(event)"
                     onclick="todoApp.switchProject('${project.id}', event)">
                    <div class="project-name-section">
                        <span class="project-name">
                            ${project.name}
                            ${taskCount > 0 ? `<span class="task-count">${taskCount}</span>` : ''}
                        </span>
                    </div>
                    <div class="project-actions" onclick="event.stopPropagation()">
                        <button class="project-btn" onclick="todoApp.showHistoryModal('${project.id}')" title="View task history">
                            <i class="fas fa-history"></i>
                        </button>
                        <button class="project-btn" onclick="todoApp.startInlineEdit(event, 'project', '${project.id}')" title="Edit project name">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button class="project-btn" onclick="todoApp.deleteProject('${project.id}')" title="Delete project">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                </div>
            `;
        }).join('');

        folderDiv.innerHTML = `
            <div class="folder-header" 
                 onclick="todoApp.toggleFolder('${folder.id}')"
                 ondragover="todoApp.handleDragOver(event)"
                 ondrop="todoApp.handleDrop(event, 'folder', '${folder.id}')">
                <i class="fas fa-chevron-${folder.expanded ? 'down' : 'right'} folder-chevron"></i>
                <span class="folder-name">${folder.name}</span>
                <div class="folder-actions">
                    <button class="folder-btn" onclick="event.stopPropagation(); todoApp.showAddProjectModal('${folder.id}')" title="Add project to folder">
                        <i class="fas fa-plus"></i>
                    </button>
                    <button class="folder-btn" onclick="event.stopPropagation(); todoApp.editFolder('${folder.id}')" title="Edit folder">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="folder-btn" onclick="event.stopPropagation(); todoApp.deleteFolder('${folder.id}')" title="Delete folder">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </div>
            <div class="folder-projects ${folder.expanded ? 'expanded' : 'collapsed'}"
                 ondragover="todoApp.handleDragOver(event)"
                 ondrop="todoApp.handleDrop(event, 'folder', '${folder.id}')">
                ${projectsHtml}
            </div>
        `;

        return folderDiv;
    }

    createUncategorizedElement() {
        const uncategorizedDiv = document.createElement('div');
        uncategorizedDiv.className = 'uncategorized-item';

        const projectsHtml = this.projectData.uncategorized.map(project => {
            const isActive = project.id === this.currentProjectId;
            const isSelected = this.selectedProjects.has(project.id);
            const taskCount = this.getProjectTaskCount(project.id);
            return `
                <div class="project-item ${isActive ? 'active' : ''} ${isSelected ? 'selected' : ''}" 
                     data-project-id="${project.id}"
                     draggable="true"
                     ondragstart="todoApp.handleDragStart(event, '${project.id}')"
                     ondragend="todoApp.handleDragEnd(event)"
                     onclick="todoApp.switchProject('${project.id}', event)">
                    <div class="project-name-section">
                        <span class="project-name">
                            ${project.name}
                            ${taskCount > 0 ? `<span class="task-count">${taskCount}</span>` : ''}
                        </span>
                    </div>
                    <div class="project-actions" onclick="event.stopPropagation()">
                        <button class="project-btn" onclick="todoApp.showHistoryModal('${project.id}')" title="View task history">
                            <i class="fas fa-history"></i>
                        </button>
                        <button class="project-btn" onclick="todoApp.startInlineEdit(event, 'project', '${project.id}')" title="Edit project name">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button class="project-btn" onclick="todoApp.deleteProject('${project.id}')" title="Delete project">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                </div>
            `;
        }).join('');

        uncategorizedDiv.innerHTML = `
            <div class="uncategorized-header"
                 ondragover="todoApp.handleDragOver(event)"
                 ondrop="todoApp.handleDrop(event, 'uncategorized', null)">
                <span class="uncategorized-name">Uncategorized</span>
            </div>
            <div class="uncategorized-projects"
                 ondragover="todoApp.handleDragOver(event)"
                 ondrop="todoApp.handleDrop(event, 'uncategorized', null)">
                ${projectsHtml}
            </div>
        `;

        return uncategorizedDiv;
    }

    renderColumns() {
        // Only render columns if user is authenticated
        if (!this.currentUser) {
            return;
        }
        
        const container = document.getElementById('columnsContainer');
        container.innerHTML = '';

        const columns = this.getCurrentColumns();
        columns.forEach(column => {
            const columnElement = this.createColumnElement(column);
            container.appendChild(columnElement);
        });

        // Add column drag and drop event listeners to the container
        container.addEventListener('dragover', (e) => this.handleColumnDragOver(e));
        container.addEventListener('drop', (e) => this.handleColumnDrop(e));
    }

    createColumnElement(column) {
        const columnDiv = document.createElement('div');
        columnDiv.className = 'column';
        columnDiv.dataset.columnId = column.id;

        columnDiv.innerHTML = `
            <div class="column-header">
                <span class="column-title editable" 
                      data-type="column" 
                      data-id="${column.id}" 
                      onclick="todoApp.startInlineEdit(event, 'column', '${column.id}')">${column.title}</span>
                <div class="column-actions">
                    <button class="column-btn" onclick="todoApp.editColumnName('${column.id}')" title="Edit column">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="column-btn" onclick="todoApp.deleteColumn('${column.id}')" title="Delete column">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </div>
            <div class="column-items" 
                 data-column-id="${column.id}">
                ${column.items.map(item => this.createItemElement(item, column.id)).join('')}
            </div>
            <button class="add-item-btn" onclick="todoApp.showAddModal('${column.id}')">
                <i class="fas fa-plus"></i>
            </button>
        `;

        // Make the entire column draggable
        columnDiv.draggable = true;
        columnDiv.addEventListener('dragstart', (e) => this.handleColumnDragStart(e, column.id));
        columnDiv.addEventListener('dragend', (e) => this.handleColumnDragEnd(e));
        
        // Add task drag and drop event listeners to the entire column
        columnDiv.addEventListener('dragover', (e) => this.handleTaskDragOver(e));
        columnDiv.addEventListener('drop', (e) => this.handleTaskDrop(e, column.id));

        return columnDiv;
    }

    createItemElement(item, columnId) {
        const hasDescription = item.description && item.description.trim().length > 0;
        const briefDescription = hasDescription ? this.getBriefDescription(item.description) : '';
        const hasDueDate = item.dueDate && item.dueDate.trim().length > 0;
        const hasPriority = item.priority && item.priority !== 'medium';
        const hasTags = item.tags && item.tags.length > 0;
        
        // Debug logging (uncomment to debug)
        // console.log('Creating item element:', {
        //     text: item.text,
        //     priority: item.priority,
        //     hasPriority: hasPriority,
        //     dueDate: item.dueDate,
        //     hasDueDate: hasDueDate,
        //     tags: item.tags,
        //     hasTags: hasTags
        // });
        
        const metadata = [];
        
        if (hasDueDate) {
            const dueDate = new Date(item.dueDate);
            const today = new Date();
            const isOverdue = dueDate < today && !item.completed;
            const isDueToday = dueDate.toDateString() === today.toDateString();
            
            let dueDateClass = 'todo-due-date';
            if (isOverdue) dueDateClass += ' overdue';
            else if (isDueToday) dueDateClass += ' due-today';
            
            metadata.push(`<span class="${dueDateClass}"><i class="fas fa-calendar"></i> Due: ${this.formatDate(dueDate)}</span>`);
        }
        
        if (hasPriority) {
            const priorityClass = `todo-priority priority-${item.priority}`;
            const priorityIcon = item.priority === 'high' ? 'fa-exclamation-triangle' : 'fa-arrow-down';
            metadata.push(`<span class="${priorityClass}"><i class="fas ${priorityIcon}"></i> ${item.priority.toUpperCase()}</span>`);
        }
        
        if (hasTags) {
            const tagsText = item.tags.slice(0, 3).join(', ') + (item.tags.length > 3 ? '...' : '');
            // Use the first tag's color for the entire tags display
            const firstTag = item.tags[0];
            const tagColorClass = this.getTagColorClass(firstTag);
            metadata.push(`<span class="todo-tags ${tagColorClass}"><i class="fas fa-tags"></i> ${tagsText}</span>`);
        }
        
        return `
            <div class="todo-item task-item ${item.completed ? 'completed' : ''}" 
                 data-item-id="${item.id}"
                 draggable="true"
                 ondragstart="todoApp.handleTaskDragStart(event, '${columnId}', '${item.id}')"
                 ondragend="todoApp.handleTaskDragEnd(event)"
                 ondragover="todoApp.handleTaskDragOver(event)"
                 ondrop="todoApp.handleTaskDrop(event, '${columnId}', '${item.id}')">
                <div class="todo-content">
                    <div class="todo-main">
                        <div class="todo-checkbox ${item.completed ? 'checked' : ''}" 
                             onclick="todoApp.toggleItem('${columnId}', '${item.id}')"></div>
                        <span class="todo-text" 
                              onclick="todoApp.showTaskDetails('${columnId}', '${item.id}')">${item.text}</span>
                    </div>
                    ${hasDescription ? `<div class="todo-description" onclick="todoApp.showTaskDetails('${columnId}', '${item.id}')">${briefDescription}</div>` : ''}
                    ${metadata.length > 0 ? `<div class="todo-metadata" onclick="todoApp.showTaskDetails('${columnId}', '${item.id}')">${metadata.join('')}</div>` : ''}
                </div>
                <div class="todo-actions">
                    <button class="todo-btn" onclick="todoApp.startInlineEdit(event, 'item', '${item.id}', '${columnId}')" title="Edit task">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="todo-btn" onclick="todoApp.deleteItem('${columnId}', '${item.id}')" title="Delete">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </div>
        `;
    }

    getBriefDescription(description) {
        return description.length > 50 ? description.substring(0, 50) + '...' : description;
    }

    formatDate(date) {
        const today = new Date();
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);
        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);
        
        if (date.toDateString() === today.toDateString()) {
            return 'Today';
        } else if (date.toDateString() === tomorrow.toDateString()) {
            return 'Tomorrow';
        } else if (date.toDateString() === yesterday.toDateString()) {
            return 'Yesterday';
        } else {
            return date.toLocaleDateString('en-US', { weekday: 'short', day: 'numeric' });
        }
    }

    getTagColorClass(tag) {
        // Normalize tag to lowercase for consistent matching
        const normalizedTag = tag.toLowerCase().replace(/[^a-z0-9]/g, '');
        
        // Priority-based tag mapping
        const tagColorMap = {
            // Priority tags
            'urgent': 'tag-urgent',
            'important': 'tag-important',
            'high': 'tag-high',
            'medium': 'tag-medium',
            'low': 'tag-low',
            
            // Status tags
            'todo': 'tag-todo',
            'inprogress': 'tag-in-progress',
            'done': 'tag-done',
            
            // Category tags
            'ui': 'tag-ui',
            'backend': 'tag-backend',
            'feature': 'tag-feature',
            'bug': 'tag-bug',
            'design': 'tag-design',
            
            // Project tags
            'instagram': 'tag-instagram',
            'business': 'tag-business',
            'personal': 'tag-personal',
            'work': 'tag-work',
            'home': 'tag-home',
            
            // Activity tags
            'meeting': 'tag-meeting',
            'deadline': 'tag-deadline',
            
            // Common variations
            'in-progress': 'tag-in-progress',
            'in_progress': 'tag-in-progress',
            'progress': 'tag-in-progress',
            'completed': 'tag-done',
            'complete': 'tag-done',
            'finished': 'tag-done',
            'critical': 'tag-urgent',
            'asap': 'tag-urgent',
            'priority': 'tag-important',
            'frontend': 'tag-ui',
            'api': 'tag-backend',
            'database': 'tag-backend',
            'server': 'tag-backend',
            'enhancement': 'tag-feature',
            'improvement': 'tag-feature',
            'fix': 'tag-bug',
            'issue': 'tag-bug',
            'error': 'tag-bug',
            'styling': 'tag-design',
            'layout': 'tag-design',
            'theme': 'tag-design',
            
            // Color-based tags
            'red': 'tag-red',
            'blue': 'tag-blue',
            'green': 'tag-green',
            'yellow': 'tag-yellow',
            'purple': 'tag-purple',
            'orange': 'tag-orange',
            'pink': 'tag-pink',
            'teal': 'tag-teal',
            'gray': 'tag-gray',
            'grey': 'tag-gray',
            'dark': 'tag-dark',
            'info': 'tag-info',
            
            // Additional common tags
            'review': 'tag-blue',
            'testing': 'tag-yellow',
            'documentation': 'tag-info',
            'research': 'tag-purple',
            'planning': 'tag-orange',
            'deployment': 'tag-green',
            'maintenance': 'tag-gray',
            'security': 'tag-red',
            'performance': 'tag-teal',
            'accessibility': 'tag-pink'
        };
        
        return tagColorMap[normalizedTag] || 'todo-tags';
    }

    startInlineEdit(event, type, id, columnId = null) {
        event.stopPropagation();
        
        let element, currentText;
        
        if (type === 'project') {
            const project = this.getAllProjects().find(p => p.id === id);
            if (!project) return;
            element = event.target.closest('.project-item').querySelector('.project-name');
            currentText = project.name;
        } else if (type === 'column') {
            const project = this.getCurrentProject();
            if (!project) return;
            const column = project.columns.find(c => c.id === id);
            if (!column) return;
            element = event.target.closest('.column-header').querySelector('.column-title');
            currentText = column.title;
        } else if (type === 'item') {
            const project = this.getCurrentProject();
            if (!project) return;
            const column = project.columns.find(c => c.id === columnId);
            if (!column) return;
            const item = column.items.find(i => i.id === id);
            if (!item) return;
            element = event.target.closest('.todo-item').querySelector('.todo-text');
            currentText = item.text;
        }
        
        if (!element) return;
        
        const input = document.createElement('input');
        input.type = 'text';
        input.value = currentText;
        input.className = 'inline-edit-input';
        
        const originalText = element.textContent;
        element.innerHTML = '';
        element.appendChild(input);
        input.focus();
        input.select();
        
        const saveEdit = () => {
            const newText = input.value.trim();
            if (newText && newText !== currentText) {
                this.saveInlineEdit(type, id, newText, columnId);
            } else {
                element.textContent = originalText;
            }
        };
        
        input.addEventListener('blur', saveEdit);
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                saveEdit();
            } else if (e.key === 'Escape') {
                element.textContent = originalText;
            }
        });
    }

    saveInlineEdit(type, id, newText, columnId = null) {
        if (type === 'project') {
            const project = this.getAllProjects().find(p => p.id === id);
            if (project) {
                project.name = newText;
                this.updateCurrentProjectName();
            }
        } else if (type === 'column') {
            const project = this.getCurrentProject();
            if (project) {
                const column = project.columns.find(c => c.id === id);
                if (column) {
                    column.title = newText;
                }
            }
        } else if (type === 'item') {
            const project = this.getCurrentProject();
            if (project) {
                const column = project.columns.find(c => c.id === columnId);
                if (column) {
                    const item = column.items.find(i => i.id === id);
                    if (item) {
                        item.text = newText;
                    }
                }
            }
        }
        
        this.saveToStorage();
        this.render();
    }

    updateCurrentProjectName() {
        // Only update project name if user is authenticated
        if (!this.currentUser) {
            return;
        }
        
        const project = this.getCurrentProject();
        if (project) {
            document.getElementById('currentProjectName').textContent = project.name;
        }
    }

    switchProject(projectId, event = null) {
        // Handle multi-select
        if (event) {
            if (event.altKey) {
                // Alt+Click: Toggle selection
                this.toggleProjectSelection(projectId);
                return;
            } else if (event.shiftKey && this.lastSelectedProject) {
                // Shift+Click: Select range
                this.selectProjectRange(this.lastSelectedProject, projectId);
                return;
            } else {
                // Regular click: Clear selection and select single project
                this.clearProjectSelection();
            }
        }
        
        this.currentProjectId = projectId;
        this.lastSelectedProject = projectId;
        this.updateCurrentProjectName();
        this.saveToStorage();
        this.render();
    }

    toggleProjectSelection(projectId) {
        if (this.selectedProjects.has(projectId)) {
            this.selectedProjects.delete(projectId);
        } else {
            this.selectedProjects.add(projectId);
        }
        this.lastSelectedProject = projectId;
        this.renderProjects();
    }

    selectProjectRange(startProjectId, endProjectId) {
        const allProjects = this.getAllProjects();
        const startIndex = allProjects.findIndex(p => p.id === startProjectId);
        const endIndex = allProjects.findIndex(p => p.id === endProjectId);
        
        if (startIndex === -1 || endIndex === -1) return;
        
        const minIndex = Math.min(startIndex, endIndex);
        const maxIndex = Math.max(startIndex, endIndex);
        
        for (let i = minIndex; i <= maxIndex; i++) {
            this.selectedProjects.add(allProjects[i].id);
        }
        
        this.lastSelectedProject = endProjectId;
        this.renderProjects();
    }

    clearProjectSelection() {
        this.selectedProjects.clear();
        this.lastSelectedProject = null;
        this.renderProjects();
    }

    deleteSelectedProjects() {
        if (this.selectedProjects.size === 0) return;
        
        const projectNames = Array.from(this.selectedProjects).map(id => {
            const project = this.getAllProjects().find(p => p.id === id);
            return project ? project.name : 'Unknown';
        });
        
        if (confirm(`Are you sure you want to delete ${this.selectedProjects.size} project(s)?\n\n${projectNames.join('\n')}`)) {
            // Remove selected projects from folders
            for (const folder of this.projectData.folders) {
                folder.projects = folder.projects.filter(p => !this.selectedProjects.has(p.id));
            }
            
            // Remove selected projects from uncategorized
            this.projectData.uncategorized = this.projectData.uncategorized.filter(p => !this.selectedProjects.has(p.id));
            
            // Clear selection
            this.clearProjectSelection();
            
            // If current project was deleted, switch to first available
            if (this.selectedProjects.has(this.currentProjectId)) {
                this.currentProjectId = this.getFirstProjectId();
            }
            
            this.saveToStorage();
            this.render();
        }
    }

    toggleFolder(folderId) {
        const folder = this.projectData.folders.find(f => f.id === folderId);
        if (folder) {
            folder.expanded = !folder.expanded;
            this.saveToStorage();
            this.renderProjects();
        }
    }

    editFolder(folderId) {
        const folder = this.projectData.folders.find(f => f.id === folderId);
        if (folder) {
            this.currentEditingFolder = folderId;
            document.getElementById('projectModalTitle').textContent = 'Edit Folder';
            document.getElementById('projectInput').value = folder.name;
            this.showAddProjectModal();
        }
    }

    deleteFolder(folderId) {
        const folder = this.projectData.folders.find(f => f.id === folderId);
        if (folder && folder.projects.length > 0) {
            if (confirm(`Are you sure you want to delete the "${folder.name}" folder? All projects in this folder will be moved to uncategorized.`)) {
                // Move projects to uncategorized
                this.projectData.uncategorized.push(...folder.projects);
                // Remove folder
                this.projectData.folders = this.projectData.folders.filter(f => f.id !== folderId);
                this.saveToStorage();
                this.render();
            }
        } else if (folder) {
            if (confirm(`Are you sure you want to delete the "${folder.name}" folder?`)) {
                this.projectData.folders = this.projectData.folders.filter(f => f.id !== folderId);
                this.saveToStorage();
                this.render();
            }
        }
    }

    deleteProject(projectId) {
        const allProjects = this.getAllProjects();
        if (allProjects.length <= 1) {
            alert('You must have at least one project!');
            return;
        }
        
        if (confirm('Are you sure you want to delete this project? All its data will be lost.')) {
            // Remove from folders
            for (const folder of this.projectData.folders) {
                folder.projects = folder.projects.filter(p => p.id !== projectId);
            }
            // Remove from uncategorized
            this.projectData.uncategorized = this.projectData.uncategorized.filter(p => p.id !== projectId);
            
            // If we deleted the current project, switch to the first available one
            if (this.currentProjectId === projectId) {
                this.currentProjectId = this.getFirstProjectId();
            }
            
            this.saveToStorage();
            this.render();
        }
    }

    toggleItem(columnId, itemId) {
        const project = this.getCurrentProject();
        if (project) {
            const column = project.columns.find(col => col.id === columnId);
            if (column) {
                const item = column.items.find(item => item.id === itemId);
                if (item) {
                    item.completed = !item.completed;
                    
                    // Track completion time
                    if (item.completed) {
                        item.completedAt = new Date().toISOString();
                    } else {
                        delete item.completedAt;
                    }
                    
                    this.saveToStorage();
                    this.render();
                }
            }
        }
    }

    deleteItem(columnId, itemId) {
        const project = this.getCurrentProject();
        if (project) {
            const column = project.columns.find(col => col.id === columnId);
            if (column) {
                const item = column.items.find(item => item.id === itemId);
                if (item) {
                    // Add to history before deleting (if it was completed)
                    if (item.completed) {
                        this.addToHistory(project.id, item);
                    }
                column.items = column.items.filter(item => item.id !== itemId);
                this.saveToStorage();
                this.render();
                }
            }
        }
    }

    showAddModal(columnId = null) {
        this.currentEditingItem = null;
        this.currentEditingColumn = columnId;
        
        // Update modal title for new task
        const modalHeader = document.querySelector('#taskDetailsModal .modal-header h3');
        if (modalHeader) {
            modalHeader.textContent = 'Add New Task';
        }
        
        // Clear the task details modal for new task
        document.getElementById('taskTitle').value = '';
        document.getElementById('taskDescription').value = '';
        document.getElementById('taskDueDate').value = '';
        document.getElementById('taskPriority').value = 'medium';
        document.getElementById('taskTags').value = '';

        // Store current editing task info (null for new task)
        this.currentEditingTask = { columnId, itemId: null };

        // Show the task details modal instead of the simple add modal
        document.getElementById('taskDetailsModal').classList.add('show');
        document.getElementById('taskTitle').focus();
    }

    hideAddModal() {
        // This function is kept for compatibility but now redirects to task details modal
        this.hideTaskDetailsModal();
        this.currentEditingItem = null;
        this.currentEditingColumn = null;
    }

    addItem() {
        const input = document.getElementById('itemInput');
        const text = input.value.trim();
        
        if (!text) return;

        const project = this.getCurrentProject();
        if (!project) return;

        const columnId = this.currentEditingColumn || project.columns[0].id;
        const column = project.columns.find(col => col.id === columnId);

        if (column) {
            const newItem = {
                id: Date.now().toString(),
                text: text,
                completed: false,
                description: '',
                dueDate: '',
                priority: 'medium',
                tags: [],
                createdAt: new Date().toISOString()
            };

            // Column tag is no longer automatically added to new tasks

            column.items.push(newItem);
            this.saveToStorage();
            this.render();
            this.hideAddModal();
        }
    }

    showAddColumnModal() {
        const modalTitle = document.querySelector('#addColumnModal h3');
        if (!this.currentEditingColumn) {
            modalTitle.textContent = 'Add New Column';
            document.getElementById('columnInput').value = '';
            document.getElementById('columnTagInput').value = '';
        } else {
            modalTitle.textContent = 'Edit Column';
            // Editing existing column - populate the fields
            const project = this.getCurrentProject();
            if (project) {
                const column = project.columns.find(c => c.id === this.currentEditingColumn);
                if (column) {
                    document.getElementById('columnInput').value = column.title;
                    document.getElementById('columnTagInput').value = column.tag || '';
                }
            }
        }
        document.getElementById('addColumnModal').classList.add('show');
        document.getElementById('columnInput').focus();
    }

    hideAddColumnModal() {
        document.getElementById('addColumnModal').classList.remove('show');
        this.currentEditingColumn = null;
    }

    showAddProjectModal(targetFolderId = null) {
        const modalTitle = document.getElementById('projectModalTitle');
        if (this.currentEditingFolder) {
            modalTitle.textContent = 'Edit Folder';
            const folder = this.projectData.folders.find(f => f.id === this.currentEditingFolder);
            if (folder) {
                document.getElementById('projectInput').value = folder.name;
            }
        } else if (this.currentEditingProject) {
            modalTitle.textContent = 'Edit Project';
            const allProjects = this.getAllProjects();
            const project = allProjects.find(p => p.id === this.currentEditingProject);
            if (project) {
                document.getElementById('projectInput').value = project.name;
            }
        } else {
            modalTitle.textContent = 'Add New Project';
            document.getElementById('projectInput').value = '';
        }
        
        // Store the target folder for project creation
        this.targetFolderId = targetFolderId;
        
        document.getElementById('addProjectModal').classList.add('show');
        document.getElementById('projectInput').focus();
    }

    hideAddProjectModal() {
        document.getElementById('addProjectModal').classList.remove('show');
        this.currentEditingProject = null;
        this.currentEditingFolder = null;
        this.targetFolderId = null;
    }

    showAddFolderModal() {
        this.currentEditingFolder = null;
        this.currentEditingProject = null;
        document.getElementById('projectModalTitle').textContent = 'Add New Folder';
        document.getElementById('projectInput').value = '';
        document.getElementById('addProjectModal').classList.add('show');
        document.getElementById('projectInput').focus();
    }

    showTaskDetails(columnId, itemId) {
        const project = this.getCurrentProject();
        if (!project) return;

        const column = project.columns.find(col => col.id === columnId);
        if (!column) return;

        const item = column.items.find(item => item.id === itemId);
        if (!item) return;

        // Update modal title for editing task
        const modalHeader = document.querySelector('#taskDetailsModal .modal-header h3');
        if (modalHeader) {
            modalHeader.textContent = 'Edit Task';
        }

        // Populate the modal with task details
        document.getElementById('taskTitle').value = item.text;
        document.getElementById('taskDescription').value = item.description || '';
        document.getElementById('taskDueDate').value = item.dueDate || '';
        document.getElementById('taskPriority').value = item.priority || 'medium';
        document.getElementById('taskTags').value = item.tags ? item.tags.join(', ') : '';

        // Store current editing task info
        this.currentEditingTask = { columnId, itemId };

        // Show the modal
        document.getElementById('taskDetailsModal').classList.add('show');
    }

    hideTaskDetailsModal() {
        document.getElementById('taskDetailsModal').classList.remove('show');
        this.currentEditingTask = null;
    }

    showInviteModal() {
        // Clear the email input
        document.getElementById('inviteEmailInput').value = '';
        // Set default permissions
        document.getElementById('permissionsSelect').value = 'view,edit';
        
        // Show the modal
        document.getElementById('invitationModal').classList.add('show');
        document.getElementById('inviteEmailInput').focus();
    }

    hideInviteModal() {
        document.getElementById('invitationModal').classList.remove('show');
    }

    sendInvitation() {
        const email = document.getElementById('inviteEmailInput').value.trim();
        const permissions = document.getElementById('permissionsSelect').value;
        
        if (!email) {
            alert('Please enter an email address');
            return;
        }

        if (!this.currentUser) {
            alert('You must be logged in to send invitations');
            return;
        }

        const project = this.getCurrentProject();
        if (!project) {
            alert('No project selected');
            return;
        }

        // For now, just show a success message
        // In a real app, this would send an actual invitation
        alert(`Invitation sent to ${email} for project "${project.name}" with ${permissions} permissions`);
        
        this.hideInviteModal();
    }

    saveTaskDetails() {
        if (!this.currentEditingTask) return;

        const project = this.getCurrentProject();
        if (!project) return;

        const column = project.columns.find(col => col.id === this.currentEditingTask.columnId);
        if (!column) return;

        const title = document.getElementById('taskTitle').value.trim();
        if (!title) return; // Don't create/update task without a title

        if (this.currentEditingTask.itemId) {
            // Editing existing task
        const item = column.items.find(item => item.id === this.currentEditingTask.itemId);
        if (!item) return;

        // Update task details
            item.text = title;
        item.description = document.getElementById('taskDescription').value.trim();
        item.dueDate = document.getElementById('taskDueDate').value;
        item.priority = document.getElementById('taskPriority').value;
        
        const tagsInput = document.getElementById('taskTags').value.trim();
        item.tags = tagsInput ? tagsInput.split(',').map(tag => tag.trim()).filter(tag => tag) : [];
        } else {
            // Creating new task
                const newItem = {
                    id: Date.now().toString(),
                    text: title,
                    completed: false,
                    description: document.getElementById('taskDescription').value.trim(),
                    dueDate: document.getElementById('taskDueDate').value,
                    priority: document.getElementById('taskPriority').value,
                    tags: [],
                    createdAt: new Date().toISOString()
                };

            const tagsInput = document.getElementById('taskTags').value.trim();
            newItem.tags = tagsInput ? tagsInput.split(',').map(tag => tag.trim()).filter(tag => tag) : [];

            // Column tag is no longer automatically added to new tasks

            column.items.push(newItem);
        }

        this.saveToStorage();
        this.render();
        this.hideTaskDetailsModal();
    }

    addColumn() {
        const input = document.getElementById('columnInput');
        const tagInput = document.getElementById('columnTagInput');
        const title = input.value.trim();
        const tag = tagInput.value.trim();
        
        if (!title) return;

        const project = this.getCurrentProject();
        if (!project) return;

        if (this.currentEditingColumn) {
            // Editing existing column
            const column = project.columns.find(c => c.id === this.currentEditingColumn);
            if (column) {
                column.title = title;
                column.tag = tag;
                // Update all tasks in this column with the new tag
                this.updateColumnTasksWithTag(column);
            }
        } else {
            // Adding new column
            const newColumn = {
                id: Date.now().toString(),
                title: title,
                tag: tag,
                items: []
            };
            project.columns.push(newColumn);
        }

        this.saveToStorage();
        this.render();
        this.hideAddColumnModal();
    }

    updateColumnTasksWithTag(column) {
        column.items.forEach(item => {
            if (!item.tags) {
                item.tags = [];
            }
            // Remove old column tag if it exists
            if (column.tag) {
                const tagIndex = item.tags.indexOf(column.tag);
                if (tagIndex === -1) {
                    item.tags.push(column.tag);
                }
            }
        });
    }

    addProject() {
        const input = document.getElementById('projectInput');
        const name = input.value.trim();
        
        if (!name) return;

        if (this.currentEditingProject) {
            // Editing existing project
            const allProjects = this.getAllProjects();
            const project = allProjects.find(p => p.id === this.currentEditingProject);
            if (project) {
                project.name = name;
            }
        } else if (this.currentEditingFolder) {
            // Editing existing folder
            const folder = this.projectData.folders.find(f => f.id === this.currentEditingFolder);
            if (folder) {
                folder.name = name;
            }
        } else {
            // Check if we're creating a folder or project based on modal title
            const modalTitle = document.getElementById('projectModalTitle').textContent;
            if (modalTitle === 'Add New Folder') {
                // Adding new folder
                const newFolder = {
                    id: Date.now().toString(),
                    name: name,
                    expanded: true,
                    projects: []
                };
                this.projectData.folders.push(newFolder);
            } else {
                // Adding new project
                const newProject = {
                    id: Date.now().toString(),
                    name: name,
                    columns: [
                        {
                            id: 'todo',
                            title: 'TODO',
                            tag: 'todo',
                            items: []
                        },
                        {
                            id: 'in-progress',
                            title: 'IN PROGRESS',
                            tag: 'in-progress',
                            items: []
                        },
                        {
                            id: 'done',
                            title: 'DONE',
                            tag: 'done',
                            items: []
                        }
                    ]
                };
                
                // Add to specific folder if targetFolderId is provided
                if (this.targetFolderId) {
                    const targetFolder = this.projectData.folders.find(f => f.id === this.targetFolderId);
                    if (targetFolder) {
                        targetFolder.projects.push(newProject);
                        // Expand the folder to show the new project
                        targetFolder.expanded = true;
                    }
                } else {
                    // Default to uncategorized
                this.projectData.uncategorized.push(newProject);
                }
            }
        }

        this.saveToStorage();
        this.render();
        this.hideAddProjectModal();
    }

    editColumnName(columnId) {
        this.currentEditingColumn = columnId;
        this.showAddColumnModal();
    }

    deleteColumn(columnId) {
        const project = this.getCurrentProject();
        if (!project) return;

        if (project.columns.length <= 1) {
            alert('You must have at least one column!');
            return;
        }

        if (confirm('Are you sure you want to delete this column? All tasks in this column will be lost.')) {
            project.columns = project.columns.filter(col => col.id !== columnId);
            this.saveToStorage();
            this.render();
        }
    }

    toggleTheme() {
        this.isDarkTheme = !this.isDarkTheme;
        document.body.classList.toggle('light-theme', !this.isDarkTheme);
        
        const themeIcon = document.getElementById('themeBtn').querySelector('i');
        themeIcon.className = this.isDarkTheme ? 'fas fa-moon' : 'fas fa-sun';
        
        this.saveToStorage();
    }

    saveToStorage() {
        console.log('saveToStorage called, currentUser:', this.currentUser);
        if (this.currentUser) {
            // Save user-specific data
            console.log('Calling saveUserData for authenticated user');
            this.saveUserData();
        } else {
            // Save global data for non-authenticated users
            const data = {
                projectData: this.projectData,
                currentProjectId: this.currentProjectId,
                isDarkTheme: this.isDarkTheme,
                sidebarWidth: this.sidebarWidth,
                isSidebarOpen: this.isSidebarOpen
            };
            localStorage.setItem('todoApp', JSON.stringify(data));
        }
    }

    loadFromStorage() {
        if (this.currentUser) {
            // Load user-specific data
            const userData = localStorage.getItem(`todoAppData_${this.currentUser.id}`);
            if (userData) {
                return JSON.parse(userData);
            }
        } else {
            // Load global data for non-authenticated users
            const data = localStorage.getItem('todoApp');
            if (data) {
                const parsed = JSON.parse(data);
                this.isDarkTheme = parsed.isDarkTheme !== false; // Default to dark theme
                this.currentProjectId = parsed.currentProjectId;
                this.sidebarWidth = parsed.sidebarWidth || 250;
                this.isSidebarOpen = parsed.isSidebarOpen !== false;
                
                document.body.classList.toggle('light-theme', !this.isDarkTheme);
                
                const themeIcon = document.getElementById('themeBtn').querySelector('i');
                themeIcon.className = this.isDarkTheme ? 'fas fa-moon' : 'fas fa-sun';
                
                // Handle migration from old format
                if (parsed.projects && !parsed.projectData) {
                    return {
                        folders: [{
                            id: 'default',
                            name: 'Default',
                            expanded: true,
                            projects: parsed.projects
                        }],
                        uncategorized: []
                    };
                }
                
                return parsed.projectData;
            }
        }
        return null;
    }

    // Task Drag and Drop Methods
    handleTaskDragStart(event, columnId, itemId) {
        this.draggedTask = { columnId, itemId };
        event.target.classList.add('dragging');
        event.dataTransfer.effectAllowed = 'move';
        event.dataTransfer.setData('text/plain', JSON.stringify({ columnId, itemId }));
        console.log('Task drag started:', { columnId, itemId });
        
        // Create task drop zone indicators
        this.createTaskDropZoneIndicators();
    }

    handleTaskDragEnd(event) {
        event.target.classList.remove('dragging');
        this.draggedTask = null;
        // Remove all drag-over classes
        document.querySelectorAll('.task-drag-over').forEach(el => {
            el.classList.remove('task-drag-over');
        });
        
        // Remove all task drop zone indicators
        this.removeTaskDropZoneIndicators();
    }

    handleTaskDragOver(event) {
        event.preventDefault();
        event.dataTransfer.dropEffect = 'move';
        
        // Remove any existing drag-over classes first
        document.querySelectorAll('.task-drag-over').forEach(el => {
            el.classList.remove('task-drag-over');
        });
        
        // Remove all active task drop zone indicators
        document.querySelectorAll('.task-drop-zone-indicator.active').forEach(el => {
            el.classList.remove('active');
        });
        
        // Find the closest task or column and determine insertion position
        const target = this.findClosestTaskDropTarget(event);
        if (target) {
            this.showTaskDropZoneIndicator(target.columnId, target.insertPosition, target.targetItemId);
        }
    }

    handleTaskDrop(event, targetColumnId, targetItemId = null) {
        event.preventDefault();
        
        // Remove visual feedback
        event.currentTarget.classList.remove('task-drag-over');
        
        if (!this.draggedTask) {
            console.log('No dragged task found');
            return;
        }
        
        const { columnId: sourceColumnId, itemId: sourceItemId } = this.draggedTask;
        
        // Find the active drop zone indicator to determine position
        const activeIndicator = document.querySelector('.task-drop-zone-indicator.active');
        if (activeIndicator) {
            const dropColumnId = activeIndicator.dataset.columnId;
            const insertPosition = activeIndicator.dataset.insertPosition;
            const dropTargetItemId = activeIndicator.dataset.targetItemId;
            
            console.log('Task drop with indicator:', { 
                sourceColumnId, 
                sourceItemId, 
                dropColumnId, 
                insertPosition, 
                dropTargetItemId 
            });
            
            // Don't allow dropping on the same position
            if (sourceColumnId === dropColumnId && sourceItemId === dropTargetItemId) {
                console.log('Same position, ignoring drop');
                return;
            }
            
            // Move the task to the calculated position
            this.moveTaskToPosition(sourceColumnId, sourceItemId, dropColumnId, insertPosition, dropTargetItemId);
        } else {
            // Fallback to original logic
            console.log('Task drop fallback:', { sourceColumnId, sourceItemId, targetColumnId, targetItemId });
            
            if (sourceColumnId === targetColumnId && sourceItemId === targetItemId) {
                console.log('Same position, ignoring drop');
                return;
            }
            
            this.moveTask(sourceColumnId, sourceItemId, targetColumnId, targetItemId);
        }
    }

    moveTask(sourceColumnId, sourceItemId, targetColumnId, targetItemId = null) {
        const project = this.getCurrentProject();
        if (!project) {
            console.log('No current project found');
            return;
        }
        
        const sourceColumn = project.columns.find(col => col.id === sourceColumnId);
        const targetColumn = project.columns.find(col => col.id === targetColumnId);
        
        if (!sourceColumn || !targetColumn) {
            console.log('Source or target column not found:', { sourceColumnId, targetColumnId });
            return;
        }
        
        console.log('Moving task from', sourceColumn.title, 'to', targetColumn.title);
        
        const sourceItemIndex = sourceColumn.items.findIndex(item => item.id === sourceItemId);
        if (sourceItemIndex === -1) return;
        
        const task = sourceColumn.items[sourceItemIndex];
        
        // Remove from source column
        sourceColumn.items.splice(sourceItemIndex, 1);
        
        // Add to target column
        if (targetItemId) {
            // Insert at specific position
            const targetItemIndex = targetColumn.items.findIndex(item => item.id === targetItemId);
            if (targetItemIndex !== -1) {
                targetColumn.items.splice(targetItemIndex, 0, task);
            } else {
                targetColumn.items.push(task);
            }
        } else {
            // Add to end of column
            targetColumn.items.push(task);
        }
        
        // Update task tags if moving to different column
        if (sourceColumnId !== targetColumnId) {
            // Remove old column tag
            if (sourceColumn.tag) {
                task.tags = task.tags.filter(tag => tag !== sourceColumn.tag);
            }
            // Add new column tag
            if (targetColumn.tag) {
                task.tags.push(targetColumn.tag);
            }
        }
        
        this.saveToStorage();
        this.render();
    }

    moveTaskToPosition(sourceColumnId, sourceItemId, targetColumnId, insertPosition, targetItemId) {
        const project = this.getCurrentProject();
        if (!project) return;
        
        const sourceColumn = project.columns.find(col => col.id === sourceColumnId);
        const targetColumn = project.columns.find(col => col.id === targetColumnId);
        
        if (!sourceColumn || !targetColumn) return;
        
        const sourceItemIndex = sourceColumn.items.findIndex(item => item.id === sourceItemId);
        if (sourceItemIndex === -1) return;
        
        const task = sourceColumn.items[sourceItemIndex];
        
        // Remove from source column
        sourceColumn.items.splice(sourceItemIndex, 1);
        
        // Calculate target position
        let targetIndex = targetColumn.items.length; // Default to end
        
        if (targetItemId) {
            const targetItemIndex = targetColumn.items.findIndex(item => item.id === targetItemId);
            if (targetItemIndex !== -1) {
                targetIndex = insertPosition === 'before' ? targetItemIndex : targetItemIndex + 1;
            }
        }
        
        // Adjust for the removed source item if moving within the same column
        if (sourceColumnId === targetColumnId && sourceItemIndex < targetIndex) {
            targetIndex--;
        }
        
        // Insert at calculated position
        targetColumn.items.splice(targetIndex, 0, task);
        
        // Update task tags if moving to different column
        if (sourceColumnId !== targetColumnId) {
            // Remove old column tag
            if (sourceColumn.tag) {
                task.tags = task.tags.filter(tag => tag !== sourceColumn.tag);
            }
            // Add new column tag
            if (targetColumn.tag) {
                task.tags.push(targetColumn.tag);
            }
        }
        
        this.saveToStorage();
        this.render();
    }

    findClosestTaskDropTarget(event) {
        const columns = document.querySelectorAll('.column');
        let closestTarget = null;
        let closestDistance = Infinity;
        
        columns.forEach(column => {
            const columnId = column.dataset.columnId;
            const columnItems = column.querySelectorAll('.task-item:not(.dragging)');
            
            // Check if dropping on empty column
            if (columnItems.length === 0) {
                const rect = column.getBoundingClientRect();
                const distance = Math.abs(event.clientY - (rect.top + rect.height / 2));
                if (distance < closestDistance) {
                    closestDistance = distance;
                    closestTarget = {
                        columnId: columnId,
                        insertPosition: 'end',
                        targetItemId: null
                    };
                }
                return;
            }
            
            // Check each task item
            columnItems.forEach((item, index) => {
                const rect = item.getBoundingClientRect();
                const itemCenter = rect.top + rect.height / 2;
                const distance = Math.abs(event.clientY - itemCenter);
                
                if (distance < closestDistance) {
                    closestDistance = distance;
                    const insertPosition = event.clientY < itemCenter ? 'before' : 'after';
                    closestTarget = {
                        columnId: columnId,
                        insertPosition: insertPosition,
                        targetItemId: item.dataset.itemId
                    };
                }
            });
            
            // Check if dropping at the end of the column
            const lastItem = columnItems[columnItems.length - 1];
            if (lastItem) {
                const rect = lastItem.getBoundingClientRect();
                const distance = Math.abs(event.clientY - (rect.bottom + 20));
                if (distance < closestDistance) {
                    closestDistance = distance;
                    closestTarget = {
                        columnId: columnId,
                        insertPosition: 'after',
                        targetItemId: lastItem.dataset.itemId
                    };
                }
            }
        });
        
        return closestTarget;
    }

    createTaskDropZoneIndicators() {
        const columns = document.querySelectorAll('.column');
        
        columns.forEach(column => {
            const columnId = column.dataset.columnId;
            const columnItems = column.querySelectorAll('.task-item:not(.dragging)');
            
            // Create indicator at the top of the column
            const topIndicator = document.createElement('div');
            topIndicator.className = 'task-drop-zone-indicator';
            topIndicator.dataset.columnId = columnId;
            topIndicator.dataset.insertPosition = 'before';
            topIndicator.dataset.targetItemId = columnItems.length > 0 ? columnItems[0].dataset.itemId : null;
            column.querySelector('.column-items').insertBefore(topIndicator, columnItems[0] || null);
            
            // Create indicators between tasks
            columnItems.forEach((item, index) => {
                const indicator = document.createElement('div');
                indicator.className = 'task-drop-zone-indicator';
                indicator.dataset.columnId = columnId;
                indicator.dataset.insertPosition = 'after';
                indicator.dataset.targetItemId = item.dataset.itemId;
                item.parentNode.insertBefore(indicator, item.nextSibling);
            });
        });
    }

    showTaskDropZoneIndicator(columnId, insertPosition, targetItemId) {
        const indicators = document.querySelectorAll('.task-drop-zone-indicator');
        indicators.forEach(indicator => {
            if (indicator.dataset.columnId === columnId && 
                indicator.dataset.insertPosition === insertPosition &&
                indicator.dataset.targetItemId === targetItemId) {
                indicator.classList.add('active');
            }
        });
    }

    removeTaskDropZoneIndicators() {
        document.querySelectorAll('.task-drop-zone-indicator').forEach(indicator => {
            indicator.remove();
        });
    }

    // Theme Toggle Method
    toggleTheme() {
        const body = document.body;
        const themeBtn = document.getElementById('themeBtn');
        const icon = themeBtn.querySelector('i');
        
        if (body.classList.contains('light-theme')) {
            // Switch to dark theme
            body.classList.remove('light-theme');
            icon.className = 'fas fa-moon';
        } else {
            // Switch to light theme
            body.classList.add('light-theme');
            icon.className = 'fas fa-sun';
        }
    }

    // Project Drag and Drop Methods
    handleDragStart(event, projectId) {
        // If the dragged project is selected, drag all selected projects
        if (this.selectedProjects.has(projectId)) {
            this.draggedProject = Array.from(this.selectedProjects);
        } else {
            this.draggedProject = [projectId];
        }
        event.target.classList.add('dragging');
        event.dataTransfer.effectAllowed = 'move';
        event.dataTransfer.setData('text/html', event.target.outerHTML);
    }

    handleDragEnd(event) {
        event.target.classList.remove('dragging');
        this.draggedProject = null;
        // Remove all drag-over classes
        document.querySelectorAll('.drag-over').forEach(el => {
            el.classList.remove('drag-over');
        });
    }

    handleDragOver(event) {
        event.preventDefault();
        event.dataTransfer.dropEffect = 'move';
        
        // Add visual feedback
        const target = event.currentTarget;
        if (target.classList.contains('folder-header') || 
            target.classList.contains('uncategorized-header') ||
            target.classList.contains('folder-projects') ||
            target.classList.contains('uncategorized-projects')) {
            target.classList.add('drag-over');
        }
    }

    handleDrop(event, targetType, targetId) {
        event.preventDefault();
        
        // Remove visual feedback
        event.currentTarget.classList.remove('drag-over');
        
        if (!this.draggedProject) return;
        
        // Handle multiple projects
        const projectIds = Array.isArray(this.draggedProject) ? this.draggedProject : [this.draggedProject];
        
        // Move all projects
        for (const projectId of projectIds) {
        // Don't allow dropping on the same location
            const currentLocation = this.getProjectLocation(projectId);
        if (currentLocation.type === targetType && currentLocation.id === targetId) {
                continue;
        }
        
        // Move the project
            this.moveProject(projectId, targetType, targetId);
        }
        
        // Clear selection after moving
        this.clearProjectSelection();
    }

    getProjectLocation(projectId) {
        // Check folders
        for (const folder of this.projectData.folders) {
            if (folder.projects.some(p => p.id === projectId)) {
                return { type: 'folder', id: folder.id };
            }
        }
        
        // Check uncategorized
        if (this.projectData.uncategorized.some(p => p.id === projectId)) {
            return { type: 'uncategorized', id: null };
        }
        
        return null;
    }

    moveProject(projectId, targetType, targetId) {
        // Find and remove the project from its current location
        let project = null;
        
        // Remove from folders
        for (const folder of this.projectData.folders) {
            const index = folder.projects.findIndex(p => p.id === projectId);
            if (index !== -1) {
                project = folder.projects.splice(index, 1)[0];
                break;
            }
        }
        
        // Remove from uncategorized if not found in folders
        if (!project) {
            const index = this.projectData.uncategorized.findIndex(p => p.id === projectId);
            if (index !== -1) {
                project = this.projectData.uncategorized.splice(index, 1)[0];
            }
        }
        
        if (!project) return;
        
        // Add to new location
        if (targetType === 'folder') {
            const targetFolder = this.projectData.folders.find(f => f.id === targetId);
            if (targetFolder) {
                targetFolder.projects.push(project);
                // Expand the target folder to show the moved project
                targetFolder.expanded = true;
            }
        } else if (targetType === 'uncategorized') {
            this.projectData.uncategorized.push(project);
        }
        
        // Save and re-render
        this.saveToStorage();
        this.render();
    }

    // Authentication Methods
    showAuthModal(isSignup = false) {
        console.log('showAuthModal called with isSignup:', isSignup);
        this.isSignupMode = isSignup;
        const modal = document.getElementById('authModal');
        const title = document.getElementById('authModalTitle');
        const submitBtn = document.getElementById('authSubmitBtn');
        const nameGroup = document.getElementById('nameGroup');
        const confirmPasswordGroup = document.getElementById('confirmPasswordGroup');
        const switchText = document.getElementById('authSwitchText');
        const switchBtn = document.getElementById('authSwitchBtn');

        if (!modal) {
            console.error('Auth modal not found');
            return;
        }

        if (isSignup) {
            title.textContent = 'Sign Up';
            submitBtn.textContent = 'Sign Up';
            nameGroup.style.display = 'block';
            confirmPasswordGroup.style.display = 'block';
            switchText.textContent = 'Already have an account?';
            switchBtn.textContent = 'Login';
        } else {
            title.textContent = 'Login';
            submitBtn.textContent = 'Login';
            nameGroup.style.display = 'none';
            confirmPasswordGroup.style.display = 'none';
            switchText.textContent = "Don't have an account?";
            switchBtn.textContent = 'Sign Up';
        }

        modal.classList.add('show');
        document.getElementById('emailInput').focus();
        console.log('Auth modal should now be visible');
    }

    hideAuthModal() {
        document.getElementById('authModal').classList.remove('show');
        document.getElementById('authForm').reset();
    }

    toggleAuthMode() {
        this.showAuthModal(!this.isSignupMode);
    }

    handleAuthSubmit(e) {
        e.preventDefault();
        
        const email = document.getElementById('emailInput').value.trim();
        const password = document.getElementById('passwordInput').value;
        const name = document.getElementById('userNameInput').value.trim();
        const confirmPassword = document.getElementById('confirmPasswordInput').value;

        if (this.isSignupMode) {
            this.signup(email, password, name, confirmPassword);
        } else {
            this.login(email, password);
        }
    }

    async signup(email, password, name, confirmPassword) {
        // Validation
        if (!email || !password || !name) {
            alert('Please fill in all fields');
            return;
        }

        if (password !== confirmPassword) {
            alert('Passwords do not match');
            return;
        }

        if (password.length < 6) {
            alert('Password must be at least 6 characters long');
            return;
        }

        try {
            const response = await fetch('/api/auth/register', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ email, password, username: name })
            });

            const data = await response.json();

            if (response.ok) {
                this.currentUser = data.user;
                localStorage.setItem('todoAppCurrentUser', JSON.stringify(data.user));
                localStorage.setItem('todoAppToken', data.token);
                this.updateAuthUI();
                this.hideAuthModal();
                this.loadUserData();
                alert('Account created successfully!');
            } else {
                console.log('Signup failed:', data.error);
                alert(data.error || 'Failed to create account');
            }
        } catch (error) {
            console.error('Signup error:', error);
            alert('Signup failed. Please try again.');
        }
    }

    async login(email, password) {
        try {
            const response = await fetch('/api/auth/login', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ email, password })
            });

            const data = await response.json();

            if (response.ok) {
                this.currentUser = data.user;
                localStorage.setItem('todoAppCurrentUser', JSON.stringify(data.user));
                localStorage.setItem('todoAppToken', data.token);
                this.updateAuthUI();
                this.hideAuthModal();
                this.loadUserData();
            } else {
                console.log('Login failed:', data.error);
                alert(data.error || 'Invalid email or password');
            }
        } catch (error) {
            console.error('Login error:', error);
            alert('Login failed. Please try again.');
        }
    }

    logout() {
        this.currentUser = null;
        localStorage.removeItem('todoAppCurrentUser');
        localStorage.removeItem('todoAppToken');
        this.updateAuthUI();
        this.projectData = this.getDefaultProjects();
        this.currentProjectId = this.getFirstProjectId();
        this.hideAuthModal(); // Hide any open auth modal
        this.showAuthModal(false); // Show login modal
    }

    getUsers() {
        const users = localStorage.getItem('todoAppUsers');
        return users ? JSON.parse(users) : [];
    }

    saveUserSession() {
        if (this.currentUser) {
            localStorage.setItem('todoAppCurrentUser', JSON.stringify(this.currentUser));
        }
    }

    loadUserSession() {
        const userSession = localStorage.getItem('todoAppCurrentUser');
        const token = localStorage.getItem('todoAppToken');
        if (userSession && token) {
            this.currentUser = JSON.parse(userSession);
            this.updateAuthUI();
            this.loadUserData();
        }
    }

    updateAuthUI() {
        const authButtons = document.getElementById('authButtons');
        const userInfo = document.getElementById('userInfo');
        const userName = document.getElementById('userName');

        if (this.currentUser) {
            authButtons.style.display = 'none';
            userInfo.style.display = 'flex';
            userName.textContent = this.currentUser.name;
            this.showMainContent();
        } else {
            authButtons.style.display = 'flex';
            userInfo.style.display = 'none';
            this.hideMainContent();
        }
    }

    hashPassword(password) {
        // Simple hash function (in production, use a proper hashing library)
        let hash = 0;
        for (let i = 0; i < password.length; i++) {
            const char = password.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; // Convert to 32-bit integer
        }
        return hash.toString();
    }

    async loadUserData() {
        if (this.currentUser) {
            try {
                console.log('Loading user data for user:', this.currentUser.email);
                console.log('User ID:', this.currentUser.id);

                const response = await fetch(`/api/user/simple-data?userId=${this.currentUser.id}`);

                console.log('API response status:', response.status);

                if (response.ok) {
                    const data = await response.json();
                    console.log('Loaded user data:', data);
                    this.projectData = data;
                    this.currentProjectId = this.getFirstProjectId();
                } else {
                    const errorData = await response.text();
                    console.error('Failed to load user data. Status:', response.status, 'Error:', errorData);
                    console.log('Using default data instead');
                    this.projectData = this.getDefaultProjects();
                    this.currentProjectId = this.getFirstProjectId();
                }
            } catch (error) {
                console.error('Error loading user data:', error);
                this.projectData = this.getDefaultProjects();
                this.currentProjectId = this.getFirstProjectId();
            }
            this.render();
        }
    }

    async refreshToken() {
        try {
            const token = localStorage.getItem('todoAppToken');
            if (!token) return false;

            const response = await fetch('/api/auth/refresh', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                }
            });

            if (response.ok) {
                const data = await response.json();
                localStorage.setItem('todoAppToken', data.token);
                console.log('Token refreshed successfully');
                return true;
            } else {
                console.log('Token refresh failed');
                return false;
            }
        } catch (error) {
            console.error('Error refreshing token:', error);
            return false;
        }
    }

    async saveUserData() {
        if (this.currentUser) {
            try {
                console.log('Saving user data for user:', this.currentUser.email);
                console.log('User ID:', this.currentUser.id);
                console.log('Data to save:', this.projectData);

                const response = await fetch('/api/user/simple-data', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        userId: this.currentUser.id,
                        data: this.projectData
                    })
                });

                console.log('Save response status:', response.status);

                if (!response.ok) {
                    const errorData = await response.text();
                    console.error('Failed to save user data. Status:', response.status, 'Error:', errorData);
                } else {
                    console.log('User data saved successfully');
                }
            } catch (error) {
                console.error('Error saving user data:', error);
            }
        }
    }

    hideMainContent() {
        // Hide the main app content when user is not authenticated
        const appBody = document.querySelector('.app-body');
        const addNewContainer = document.querySelector('.add-new-container');
        const welcomeMessage = document.getElementById('welcomeMessage');
        
        if (appBody) {
            appBody.style.display = 'none';
        }
        if (addNewContainer) {
            addNewContainer.style.display = 'none';
        }
        if (welcomeMessage) {
            welcomeMessage.style.display = 'flex';
        }
    }

    showMainContent() {
        // Show the main app content when user is authenticated
        const appBody = document.querySelector('.app-body');
        const addNewContainer = document.querySelector('.add-new-container');
        const welcomeMessage = document.getElementById('welcomeMessage');
        
        if (appBody) {
            appBody.style.display = 'flex';
        }
        if (addNewContainer) {
            addNewContainer.style.display = 'block';
        }
        if (welcomeMessage) {
            welcomeMessage.style.display = 'none';
        }
    }

    render() {
        // Check if user is authenticated
        if (!this.currentUser) {
            this.hideMainContent();
            return;
        }
        
        // User is authenticated, show main content
        this.showMainContent();
        this.renderProjects();
        this.renderColumns();
        this.updateCurrentProjectName();
    }

    // History Methods
    getProjectHistory(projectId) {
        return this.historyData[projectId] || [];
    }

    showHistoryModal(projectId) {
        const allProjects = this.getAllProjects();
        const project = allProjects.find(p => p.id === projectId);
        if (!project) return;
        
        const history = this.getProjectHistory(projectId);
        console.log('Showing history for project:', projectId, 'History:', history);
        
        const modal = document.getElementById('historyModal');
        const modalTitle = document.getElementById('historyModalTitle');
        const historyList = document.getElementById('historyList');
        
        modalTitle.textContent = `${project.name} - Task History`;
        
        if (history.length === 0) {
            historyList.innerHTML = '<div class="no-history">No completed tasks found in history.</div>';
        } else {
            // Sort by completion date (newest first)
            const sortedHistory = history.sort((a, b) => new Date(b.completedAt) - new Date(a.completedAt));
            historyList.innerHTML = sortedHistory.map(entry => this.createHistoryEntry(entry)).join('');
        }
        
        modal.classList.add('show');
    }

    createHistoryEntry(entry) {
        const completedDate = new Date(entry.completedAt);
        const createdDate = new Date(entry.createdAt);
        
        const hasDescription = entry.description && entry.description.trim().length > 0;
        const hasDueDate = entry.dueDate && entry.dueDate.trim().length > 0;
        const hasPriority = entry.priority && entry.priority !== 'medium';
        const hasTags = entry.tags && entry.tags.length > 0;
        
        const metadata = [];
        
        if (hasDueDate) {
            const dueDate = new Date(entry.dueDate);
            metadata.push(`<span class="history-due-date"><i class="fas fa-calendar"></i> Due: ${this.formatDate(dueDate)}</span>`);
        }
        
        if (hasPriority) {
            const priorityClass = `history-priority priority-${entry.priority}`;
            const priorityIcon = entry.priority === 'high' ? 'fa-exclamation-triangle' : 'fa-arrow-down';
            metadata.push(`<span class="${priorityClass}"><i class="fas ${priorityIcon}"></i> ${entry.priority.toUpperCase()}</span>`);
        }
        
        if (hasTags) {
            const tagsText = entry.tags.slice(0, 3).join(', ') + (entry.tags.length > 3 ? '...' : '');
            const firstTag = entry.tags[0];
            const tagColorClass = this.getTagColorClass(firstTag);
            metadata.push(`<span class="history-tags ${tagColorClass}"><i class="fas fa-tags"></i> ${tagsText}</span>`);
        }
        
        return `
            <div class="history-entry">
                <div class="history-content">
                    <div class="history-main">
                        <span class="history-text">${entry.text}</span>
                    </div>
                    ${hasDescription ? `<div class="history-description">${entry.description}</div>` : ''}
                    ${metadata.length > 0 ? `<div class="history-metadata">${metadata.join('')}</div>` : ''}
                    <div class="history-dates">
                        <span class="history-date"><i class="fas fa-plus"></i> Created: ${this.formatDate(createdDate)}</span>
                        <span class="history-date"><i class="fas fa-check"></i> Completed: ${this.formatDate(completedDate)}</span>
                    </div>
                </div>
            </div>
        `;
    }

    hideHistoryModal() {
        document.getElementById('historyModal').classList.remove('show');
    }

    // Column Drag and Drop Methods
    handleColumnDragStart(event, columnId) {
        this.draggedColumn = columnId;
        event.currentTarget.classList.add('dragging');
        event.dataTransfer.effectAllowed = 'move';
        event.dataTransfer.setData('text/plain', columnId);
        
        // Add drag-active class to container
        const container = document.getElementById('columnsContainer');
        container.classList.add('drag-active');
        
        // Create drop zone indicators
        this.createDropZoneIndicators();
    }

    handleColumnDragEnd(event) {
        event.currentTarget.classList.remove('dragging');
        this.draggedColumn = null;
        
        // Remove all column drag-over classes
        document.querySelectorAll('.column-drag-over').forEach(el => {
            el.classList.remove('column-drag-over');
        });
        
        // Remove drag-active class from container
        const container = document.getElementById('columnsContainer');
        container.classList.remove('drag-active');
        
        // Remove all drop zone indicators
        this.removeDropZoneIndicators();
    }

    handleColumnDragOver(event) {
        event.preventDefault();
        event.dataTransfer.dropEffect = 'move';
        
        // Remove any existing drag-over classes first
        document.querySelectorAll('.column-drag-over').forEach(el => {
            el.classList.remove('column-drag-over');
        });
        
        // Remove all active drop zone indicators
        document.querySelectorAll('.drop-zone-indicator.active').forEach(el => {
            el.classList.remove('active');
        });
        
        // Find the closest column and show appropriate drop zone
        const columns = document.querySelectorAll('.column:not(.dragging)');
        let closestColumn = null;
        let closestDistance = Infinity;
        let insertPosition = 'after'; // 'before' or 'after'
        
        columns.forEach(column => {
            const rect = column.getBoundingClientRect();
            const columnCenter = rect.left + rect.width / 2;
            const distance = Math.abs(event.clientX - columnCenter);
            
            if (distance < closestDistance) {
                closestDistance = distance;
                closestColumn = column;
                insertPosition = event.clientX < columnCenter ? 'before' : 'after';
            }
        });
        
        if (closestColumn) {
            // Show drop zone indicator
            this.showDropZoneIndicator(closestColumn, insertPosition);
        }
    }

    handleColumnDrop(event, targetColumnId = null) {
        event.preventDefault();
        
        // Remove visual feedback
        event.currentTarget.classList.remove('column-drag-over');
        
        if (!this.draggedColumn) {
            return;
        }
        
        // Find the active drop zone indicator to determine position
        const activeIndicator = document.querySelector('.drop-zone-indicator.active');
        if (activeIndicator) {
            const targetColumn = activeIndicator.dataset.targetColumn;
            const insertPosition = activeIndicator.dataset.insertPosition;
            
            if (targetColumn && this.draggedColumn !== targetColumn) {
                this.moveColumnToPosition(this.draggedColumn, targetColumn, insertPosition);
            }
        }
    }

    moveColumn(sourceColumnId, targetColumnId) {
        const project = this.getCurrentProject();
        if (!project) return;
        
        const sourceIndex = project.columns.findIndex(col => col.id === sourceColumnId);
        const targetIndex = project.columns.findIndex(col => col.id === targetColumnId);
        
        if (sourceIndex === -1 || targetIndex === -1) return;
        
        // Remove source column
        const [movedColumn] = project.columns.splice(sourceIndex, 1);
        
        // Insert at target position
        project.columns.splice(targetIndex, 0, movedColumn);
        
        this.saveToStorage();
        this.render();
    }

    moveColumnToPosition(sourceColumnId, targetColumnId, insertPosition) {
        const project = this.getCurrentProject();
        if (!project) return;
        
        const sourceIndex = project.columns.findIndex(col => col.id === sourceColumnId);
        const targetIndex = project.columns.findIndex(col => col.id === targetColumnId);
        
        if (sourceIndex === -1 || targetIndex === -1) return;
        
        // Remove source column
        const [movedColumn] = project.columns.splice(sourceIndex, 1);
        
        // Calculate new target index based on insert position
        let newTargetIndex = targetIndex;
        if (insertPosition === 'after') {
            newTargetIndex = targetIndex + 1;
        }
        
        // Adjust for the removed source column
        if (sourceIndex < targetIndex) {
            newTargetIndex--;
        }
        
        // Insert at calculated position
        project.columns.splice(newTargetIndex, 0, movedColumn);
        
        this.saveToStorage();
        this.render();
    }

    createDropZoneIndicators() {
        const container = document.getElementById('columnsContainer');
        const columns = container.querySelectorAll('.column:not(.dragging)');
        
        columns.forEach((column, index) => {
            // Create indicator before first column
            if (index === 0) {
                const indicator = document.createElement('div');
                indicator.className = 'drop-zone-indicator';
                indicator.dataset.targetColumn = column.dataset.columnId;
                indicator.dataset.insertPosition = 'before';
                container.insertBefore(indicator, column);
            }
            
            // Create indicator after each column
            const indicator = document.createElement('div');
            indicator.className = 'drop-zone-indicator';
            indicator.dataset.targetColumn = column.dataset.columnId;
            indicator.dataset.insertPosition = 'after';
            column.parentNode.insertBefore(indicator, column.nextSibling);
        });
    }

    showDropZoneIndicator(targetColumn, insertPosition) {
        const indicators = document.querySelectorAll('.drop-zone-indicator');
        indicators.forEach(indicator => {
            if (indicator.dataset.targetColumn === targetColumn.dataset.columnId && 
                indicator.dataset.insertPosition === insertPosition) {
                indicator.classList.add('active');
            }
        });
    }

    removeDropZoneIndicators() {
        document.querySelectorAll('.drop-zone-indicator').forEach(indicator => {
            indicator.remove();
        });
    }
}

// Initialize the app when the page loads
let todoApp;
document.addEventListener('DOMContentLoaded', () => {
    console.log('DOM Content Loaded - starting TodoApp initialization');
    try {
        todoApp = new TodoApp();
        console.log('TodoApp initialized successfully:', todoApp);
    } catch (error) {
        console.error('Error initializing TodoApp:', error);
        console.error('Error stack:', error.stack);
        // Don't clear localStorage - this destroys user data!
        // Instead, show error message to user
        alert('Error initializing app. Please refresh the page or contact support.');
    }
});

// Add global function to clear data and reset
window.resetTodoApp = function() {
    localStorage.clear();
    location.reload();
};

// Add global function to check history data
window.checkHistory = function() {
    if (todoApp) {
        console.log('Current history data:', todoApp.historyData);
        console.log('History data from localStorage:', JSON.parse(localStorage.getItem('todoAppHistory') || '{}'));
        return todoApp.historyData;
    } else {
        console.error('todoApp not available');
    }
};

// Add global function to check current project tasks
window.checkCurrentTasks = function() {
    if (todoApp) {
        const project = todoApp.getCurrentProject();
        if (project) {
            console.log('Current project:', project.name);
            project.columns.forEach(column => {
                console.log(`Column: ${column.title}`);
                column.items.forEach(item => {
                    console.log('Task:', {
                        text: item.text,
                        priority: item.priority,
                        hasPriority: item.priority && item.priority !== 'medium',
                        dueDate: item.dueDate,
                        tags: item.tags,
                        description: item.description
                    });
                });
            });
        } else {
            console.log('No current project');
        }
    } else {
        console.error('todoApp not available');
    }
};

// Add global function to fix a specific task's priority
window.fixTaskPriority = function(taskText, newPriority) {
    if (todoApp) {
        const project = todoApp.getCurrentProject();
        if (project) {
            project.columns.forEach(column => {
                const item = column.items.find(item => item.text === taskText);
                if (item) {
                    console.log('Found task:', item.text, 'Current priority:', item.priority);
                    item.priority = newPriority;
                    console.log('Updated priority to:', newPriority);
                    todoApp.saveToStorage();
                    todoApp.render();
                    return;
                }
            });
        }
    }
};

// Add global function to test authentication
window.testAuth = function() {
    if (todoApp && typeof todoApp.showAuthModal === 'function') {
        console.log('Testing auth modal...');
        todoApp.showAuthModal(false);
    } else {
        console.error('todoApp not available or showAuthModal method missing');
        console.log('todoApp:', todoApp);
        if (todoApp) {
            console.log('Available methods:', Object.getOwnPropertyNames(Object.getPrototypeOf(todoApp)));
        }
    }
};

// Add global function to debug users
window.debugUsers = function() {
    if (todoApp) {
        const users = todoApp.getUsers();
        console.log('All users in system:', users);
        console.log('Current user:', todoApp.currentUser);
        return users;
    } else {
        console.error('todoApp not available');
    }
};

// Add global function to create a test user
window.createTestUser = function() {
    if (todoApp) {
        const testUser = {
            id: 'test-user-1',
            email: 'test@example.com',
            password: todoApp.hashPassword('password123'),
            name: 'Test User',
            createdAt: new Date().toISOString()
        };
        
        const users = todoApp.getUsers();
        users.push(testUser);
        localStorage.setItem('todoAppUsers', JSON.stringify(users));
        console.log('Test user created:', testUser);
        console.log('Email: test@example.com, Password: password123');
        return testUser;
    } else {
        console.error('todoApp not available');
    }
};

// Add global function to reset a user's password
window.resetUserPassword = function(email, newPassword) {
    if (todoApp) {
        const users = todoApp.getUsers();
        const userIndex = users.findIndex(u => u.email === email);
        
        if (userIndex !== -1) {
            users[userIndex].password = todoApp.hashPassword(newPassword);
            localStorage.setItem('todoAppUsers', JSON.stringify(users));
            console.log(`Password reset for ${email} to: ${newPassword}`);
            console.log('New password hash:', users[userIndex].password);
            return true;
        } else {
            console.log(`User ${email} not found`);
            return false;
        }
    } else {
        console.error('todoApp not available');
    }
};