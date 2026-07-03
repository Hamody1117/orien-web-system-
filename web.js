console.log('✅ web.js loaded');

let auth, db, currentUser = null;
let burndownChart, statusChart, reportDistChart, reportRateChart;

function waitForFirebase() {
    return new Promise((resolve) => {
        if (typeof window.auth !== 'undefined' && window.auth) {
            auth = window.auth;
            db = window.db;
            console.log('✅ Firebase ready');
            resolve(true);
        } else {
            console.log('⏳ Waiting for Firebase...');
            setTimeout(() => waitForFirebase().then(resolve), 300);
        }
    });
}

function formatDate(dateString) {
    if (!dateString) return 'No date';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    const icon = type === 'success' ? 'check-circle' : type === 'warning' ? 'exclamation-triangle' : 'info-circle';
    notification.innerHTML = `<i class="fas fa-${icon}"></i><span>${message}</span>`;
    document.body.appendChild(notification);
    setTimeout(() => notification.remove(), 3000);
}

function populateProjectSelect() {
    const select = document.getElementById('taskProject');
    if (!select) return;
    const projects = JSON.parse(localStorage.getItem('projects')) || [];
    select.innerHTML = '<option value="">Select Project</option>';
    projects.forEach(p => {
        select.innerHTML += `<option value="${p.id}">${p.name}</option>`;
    });
}

function populateSprintProjectSelect() {
    const select = document.getElementById('sprintProject');
    if (!select) return;
    const projects = JSON.parse(localStorage.getItem('projects')) || [];
    select.innerHTML = '<option value="">Select Project</option>';
    projects.forEach(p => {
        select.innerHTML += `<option value="${p.id}">${p.name}</option>`;
    });
}

function switchTab(tab) {
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    const navItem = document.querySelector(`.nav-item[data-section="${tab}"]`);
    if (navItem) navItem.classList.add('active');
    document.querySelectorAll('.page-section').forEach(s => s.classList.remove('active'));
    const section = document.getElementById(`${tab}-section`);
    if (section) section.classList.add('active');
    if (tab === 'dashboard') updateUI();
    if (tab === 'projects') renderProjects();
    if (tab === 'tasks') renderTasksList();
    if (tab === 'board') renderBoard();
    if (tab === 'backlog') renderBacklog();
    if (tab === 'sprints') renderSprints();
    if (tab === 'reports') updateReports();
}

async function loadApp() {
    console.log('🚀 Loading app...');
    try {
        await loadProjects();
        await loadTasks();
        await loadSprints();
        updateUI();
        setupCharts();
        console.log('✅ App loaded successfully');
    } catch (error) {
        console.error('❌ Error loading app:', error);
    }
}

async function loadProjects() {
    try {
        const snapshot = await window.db.collection('projects').get();
        const projects = [];
        snapshot.forEach(doc => projects.push({ id: doc.id, ...doc.data() }));
        localStorage.setItem('projects', JSON.stringify(projects));
        console.log('✅ Projects loaded:', projects.length);
        return projects;
    } catch (error) {
        console.error('❌ Error loading projects:', error);
        return [];
    }
}

async function loadTasks() {
    try {
        const snapshot = await window.db.collection('tasks').get();
        const tasks = [];
        snapshot.forEach(doc => tasks.push({ id: doc.id, ...doc.data() }));
        localStorage.setItem('tasks', JSON.stringify(tasks));
        console.log('✅ Tasks loaded:', tasks.length);
        return tasks;
    } catch (error) {
        console.error('❌ Error loading tasks:', error);
        return [];
    }
}

async function loadSprints() {
    try {
        const snapshot = await window.db.collection('sprints').get();
        const sprints = [];
        snapshot.forEach(doc => sprints.push({ id: doc.id, ...doc.data() }));
        localStorage.setItem('sprints', JSON.stringify(sprints));
        console.log('✅ Sprints loaded:', sprints.length);
        return sprints;
    } catch (error) {
        console.error('❌ Error loading sprints:', error);
        return [];
    }
}

function updateUI() {
    const tasks = JSON.parse(localStorage.getItem('tasks')) || [];
    const projects = JSON.parse(localStorage.getItem('projects')) || [];
    const sprints = JSON.parse(localStorage.getItem('sprints')) || [];
    const userName = localStorage.getItem('userName') || 'User';

    const total = tasks.length;
    const done = tasks.filter(t => t.status === 'done').length;
    const todo = tasks.filter(t => t.status === 'todo').length;
    const activeSprints = sprints.filter(s => s.status === 'active').length;

    document.getElementById('total-projects').textContent = projects.length;
    document.getElementById('total-tasks').textContent = total;
    document.getElementById('active-sprints').textContent = activeSprints;
    document.getElementById('completed-tasks').textContent = done;

    const completedSprints = sprints.filter(s => s.status === 'completed');
    let totalVelocity = 0;
    completedSprints.forEach(s => {
        const sprintTasks = tasks.filter(t => t.sprintId === s.id && t.status === 'done');
        totalVelocity += sprintTasks.length;
    });
    const avgVelocity = completedSprints.length > 0 ? Math.round(totalVelocity / completedSprints.length) : 0;
    document.getElementById('team-velocity').textContent = avgVelocity;

    const rate = total > 0 ? Math.round((done / total) * 100) : 0;
    document.getElementById('completion-rate').textContent = rate + '%';

    document.getElementById('dashboard-badge').textContent = total;
    document.getElementById('projects-badge').textContent = projects.length;
    document.getElementById('tasks-badge').textContent = total;
    document.getElementById('sprints-badge').textContent = sprints.length;
    document.getElementById('backlog-badge').textContent = todo;

    document.getElementById('userNameDisplay').textContent = userName;
    document.querySelectorAll('.user-name-display').forEach(el => {
        if (el) el.textContent = userName;
    });
    document.getElementById('userAvatar').src = `https://ui-avatars.com/api/?name=${userName}&background=2563eb&color=fff`;

    renderRecentTasks();
    renderRecentProjects();
    renderTeamOverview();
    renderTasksList();
    renderBoard();
    renderProjects();
    renderSprints();
    renderBacklog();
    updateCharts();
    updateReports();
}

function renderRecentProjects() {
    const container = document.getElementById('projects-mini-grid');
    if (!container) return;
    const projects = JSON.parse(localStorage.getItem('projects')) || [];
    const tasks = JSON.parse(localStorage.getItem('tasks')) || [];
    if (projects.length === 0) {
        container.innerHTML = '<p class="empty-message">No projects yet</p>';
        return;
    }
    let html = '';
    projects.slice(0, 3).forEach(project => {
        const projectTasks = tasks.filter(t => t.projectId === project.id);
        const completed = projectTasks.filter(t => t.status === 'done').length;
        const progress = projectTasks.length > 0 ? Math.round((completed / projectTasks.length) * 100) : 0;
        html += `
            <div class="mini-project-card" onclick="switchTab('projects')">
                <div class="mini-project-header"><h4>${project.name}</h4><span class="status-badge ${project.status}">${project.status}</span></div>
                <div class="mini-project-progress"><div class="mini-progress-bar"><div class="mini-progress-fill" style="width: ${progress}%;"></div></div><span>${progress}%</span></div>
                <div style="font-size:0.75rem;color:var(--light-text-light);margin-top:4px;">${projectTasks.length} tasks · ${completed} done</div>
            </div>
        `;
    });
    container.innerHTML = html;
}

function renderRecentTasks() {
    const list = document.getElementById('recent-tasks-list');
    if (!list) return;
    const tasks = JSON.parse(localStorage.getItem('tasks')) || [];
    if (tasks.length === 0) {
        list.innerHTML = '<p class="empty-message">No tasks yet</p>';
        return;
    }
    const recent = tasks.slice(-5).reverse();
    let html = '';
    recent.forEach(task => {
        html += `
            <div class="mini-task priority-${task.priority || 'medium'}" onclick="openEditTask('${task.id}')">
                ${task.title}
                <small>👤 ${task.assignee || 'Unassigned'}</small>
            </div>
        `;
    });
    list.innerHTML = html;
}

function renderTeamOverview() {
    const container = document.getElementById('team-mini-grid');
    if (!container) return;
    const teamMembers = [
        { name: 'John Doe', role: 'Product Owner', tasks: 12, done: 9 },
        { name: 'Jane Smith', role: 'Developer', tasks: 8, done: 5 },
        { name: 'Mike Johnson', role: 'Designer', tasks: 5, done: 3 },
        { name: 'Sara Ahmed', role: 'Developer', tasks: 7, done: 4 }
    ];
    if (teamMembers.length === 0) {
        container.innerHTML = '<p class="empty-message">No team members yet</p>';
        return;
    }
    let html = '';
    teamMembers.forEach(member => {
        const progress = member.tasks > 0 ? Math.round((member.done / member.tasks) * 100) : 0;
        html += `
            <div class="team-mini-card" onclick="switchTab('team')">
                <div class="team-mini-avatar"><img src="https://ui-avatars.com/api/?name=${member.name}&background=2563eb&color=fff" alt="${member.name}"></div>
                <div class="team-mini-info"><div class="team-mini-name">${member.name}</div><div class="team-mini-role">${member.role}</div></div>
                <div class="team-mini-stats">
                    <div class="team-mini-stat"><span class="stat-value">${member.tasks}</span><span class="stat-label">Tasks</span></div>
                    <div class="team-mini-stat"><span class="stat-value">${member.done}</span><span class="stat-label">Done</span></div>
                    <div class="team-mini-stat"><span class="stat-value">${progress}%</span><span class="stat-label">Progress</span></div>
                </div>
            </div>
        `;
    });
    container.innerHTML = html;
}

function renderProjects() {
    const grid = document.getElementById('projects-grid');
    const projects = JSON.parse(localStorage.getItem('projects')) || [];
    const tasks = JSON.parse(localStorage.getItem('tasks')) || [];
    if (!grid) return;
    if (projects.length === 0) {
        grid.innerHTML = '<p class="empty-message">No projects yet. Create your first project!</p>';
        return;
    }
    let html = '';
    projects.forEach(project => {
        const projectTasks = tasks.filter(t => t.projectId === project.id);
        const completed = projectTasks.filter(t => t.status === 'done').length;
        const progress = projectTasks.length > 0 ? Math.round((completed / projectTasks.length) * 100) : 0;
        html += `
            <div class="project-card">
                <div class="project-header"><h3>${project.name}</h3><div class="project-actions"><button class="action-btn" onclick="openEditProject('${project.id}')"><i class="fas fa-edit"></i></button><button class="action-btn delete" onclick="deleteProject('${project.id}')"><i class="fas fa-trash"></i></button></div></div>
                <div class="project-content"><p class="project-description">${project.description || 'No description'}</p><div class="project-stats"><div class="project-stat"><span class="stat-value">${projectTasks.length}</span><span class="stat-label">Tasks</span></div><div class="project-stat"><span class="stat-value">${completed}</span><span class="stat-label">Done</span></div><div class="project-stat"><span class="stat-value">${projectTasks.length - completed}</span><span class="stat-label">Remaining</span></div></div><div class="project-progress"><div class="progress-header"><span>Progress</span><span>${progress}%</span></div><div class="progress-bar"><div class="progress-fill" style="width: ${progress}%;"></div></div></div></div>
                <div class="project-footer"><span><i class="far fa-calendar"></i> ${formatDate(project.createdAt)}</span><span class="status-badge ${project.status}">${project.status}</span></div>
            </div>
        `;
    });
    grid.innerHTML = html;
    document.querySelectorAll('.projects-filters .filter-btn').forEach(b => b.classList.remove('active'));
    const allBtn = document.querySelector('.projects-filters .filter-btn[data-project-filter="all"]');
    if (allBtn) allBtn.classList.add('active');
}

document.addEventListener('click', function(e) {
    const filterBtn = e.target.closest('.projects-filters .filter-btn');
    if (filterBtn) {
        e.preventDefault();
        document.querySelectorAll('.projects-filters .filter-btn').forEach(b => b.classList.remove('active'));
        filterBtn.classList.add('active');
        const filter = filterBtn.dataset.projectFilter || 'all';
        const projects = JSON.parse(localStorage.getItem('projects')) || [];
        const tasks = JSON.parse(localStorage.getItem('tasks')) || [];
        const grid = document.getElementById('projects-grid');
        if (!grid) return;
        let filteredProjects = projects;
        if (filter !== 'all') filteredProjects = projects.filter(p => p.status === filter);
        if (filteredProjects.length === 0) {
            grid.innerHTML = `<p class="empty-message">No ${filter} projects found</p>`;
            return;
        }
        let html = '';
        filteredProjects.forEach(project => {
            const projectTasks = tasks.filter(t => t.projectId === project.id);
            const completed = projectTasks.filter(t => t.status === 'done').length;
            const progress = projectTasks.length > 0 ? Math.round((completed / projectTasks.length) * 100) : 0;
            html += `
                <div class="project-card">
                    <div class="project-header"><h3>${project.name}</h3><div class="project-actions"><button class="action-btn" onclick="openEditProject('${project.id}')"><i class="fas fa-edit"></i></button><button class="action-btn delete" onclick="deleteProject('${project.id}')"><i class="fas fa-trash"></i></button></div></div>
                    <div class="project-content"><p class="project-description">${project.description || 'No description'}</p><div class="project-stats"><div class="project-stat"><span class="stat-value">${projectTasks.length}</span><span class="stat-label">Tasks</span></div><div class="project-stat"><span class="stat-value">${completed}</span><span class="stat-label">Done</span></div><div class="project-stat"><span class="stat-value">${projectTasks.length - completed}</span><span class="stat-label">Remaining</span></div></div><div class="project-progress"><div class="progress-header"><span>Progress</span><span>${progress}%</span></div><div class="progress-bar"><div class="progress-fill" style="width: ${progress}%;"></div></div></div></div>
                    <div class="project-footer"><span><i class="far fa-calendar"></i> ${formatDate(project.createdAt)}</span><span class="status-badge ${project.status}">${project.status}</span></div>
                </div>
            `;
        });
        grid.innerHTML = html;
    }
});

function renderTasksList() {
    const list = document.getElementById('tasks-list');
    const tasks = JSON.parse(localStorage.getItem('tasks')) || [];
    const projects = JSON.parse(localStorage.getItem('projects')) || [];
    const activeFilter = document.querySelector('.filter-btn.active')?.dataset.filter || 'all';
    if (!list) return;
    if (tasks.length === 0) {
        list.innerHTML = '<p class="empty-message">No tasks yet</p>';
        return;
    }
    let filteredTasks = tasks;
    if (activeFilter !== 'all') filteredTasks = filteredTasks.filter(t => t.status === activeFilter);
    if (filteredTasks.length === 0) {
        list.innerHTML = '<p class="empty-message">No tasks match filter</p>';
        return;
    }
    let html = '';
    filteredTasks.forEach(task => {
        const project = projects.find(p => p.id === task.projectId);
        const projectName = project ? project.name : 'No Project';
        html += `
            <div class="task-item">
                <input type="checkbox" class="task-checkbox" ${task.status === 'done' ? 'checked' : ''} onchange="toggleTaskStatus('${task.id}')">
                <div class="task-content">
                    <div class="task-header"><h4>${task.title}</h4><span class="priority-badge ${task.priority || 'medium'}">${task.priority || 'Medium'}</span><span class="status-badge ${task.status || 'todo'}">${task.status || 'To Do'}</span><span style="font-size:0.7rem;color:var(--light-text-light);"><i class="fas fa-folder"></i> ${projectName}</span></div>
                    <p style="font-size:0.85rem;color:var(--light-text-secondary);">${task.description || ''}</p>
                    <div class="task-meta"><span><i class="fas fa-user"></i> ${task.assignee || 'Unassigned'}</span><span><i class="far fa-calendar"></i> ${task.dueDate ? formatDate(task.dueDate) : 'No date'}</span></div>
                </div>
                <div class="task-actions"><button class="action-btn" onclick="openEditTask('${task.id}')"><i class="fas fa-edit"></i></button><button class="action-btn delete" onclick="deleteTask('${task.id}')"><i class="fas fa-trash"></i></button></div>
            </div>
        `;
    });
    list.innerHTML = html;
}

function renderBoard() {
    const tasks = JSON.parse(localStorage.getItem('tasks')) || [];
    ['todo', 'progress', 'review', 'done'].forEach(status => {
        const container = document.getElementById(`board-${status}`);
        const count = document.getElementById(`board-${status}-count`);
        if (!container) return;
        const filtered = tasks.filter(t => t.status === status);
        if (count) count.textContent = filtered.length;
        container.innerHTML = '';
        filtered.forEach(task => {
            const card = document.createElement('div');
            card.className = 'board-task-card';
            card.innerHTML = `
                <div class="task-priority ${task.priority || 'medium'}">${task.priority || 'Medium'}</div>
                <h5 onclick="openEditTask('${task.id}')">${task.title}</h5>
                <small><i class="fas fa-user"></i> ${task.assignee || 'Unassigned'}</small>
            `;
            container.appendChild(card);
        });
    });
}

function renderSprints() {
    const container = document.getElementById('sprints-container');
    const sprints = JSON.parse(localStorage.getItem('sprints')) || [];
    const tasks = JSON.parse(localStorage.getItem('tasks')) || [];
    const projects = JSON.parse(localStorage.getItem('projects')) || [];
    if (!container) return;
    if (sprints.length === 0) {
        container.innerHTML = '<p class="empty-message">No sprints yet</p>';
        return;
    }
    let html = '';
    sprints.forEach(sprint => {
        const project = projects.find(p => p.id === sprint.projectId);
        const projectName = project ? project.name : 'No Project';
        const sprintTasks = tasks.filter(t => t.sprintId === sprint.id);
        const completed = sprintTasks.filter(t => t.status === 'done').length;
        const progress = sprintTasks.length > 0 ? Math.round((completed / sprintTasks.length) * 100) : 0;
        html += `
            <div class="sprint-card ${sprint.status}">
                <div class="sprint-header"><div><h3>${sprint.name}</h3><span class="sprint-badge">${sprint.status}</span></div><div class="sprint-actions"><button class="action-btn" onclick="openEditSprint('${sprint.id}')"><i class="fas fa-edit"></i></button><button class="action-btn delete" onclick="deleteSprint('${sprint.id}')"><i class="fas fa-trash"></i></button></div></div>
                <p class="sprint-goal">🎯 ${sprint.goal || 'No goal set'}</p>
                <div class="sprint-dates"><span><i class="far fa-calendar-alt"></i> ${formatDate(sprint.startDate)} - ${formatDate(sprint.endDate)}</span></div>
                <div class="sprint-meta"><span><i class="fas fa-folder"></i> ${projectName}</span></div>
                <div class="sprint-stats-grid">
                    <div class="stat"><span class="stat-value">${sprintTasks.length}</span><span class="stat-label">Total</span></div>
                    <div class="stat"><span class="stat-value">${completed}</span><span class="stat-label">Done</span></div>
                    <div class="stat"><span class="stat-value">${sprintTasks.length - completed}</span><span class="stat-label">Left</span></div>
                    <div class="stat"><span class="stat-value">${progress}%</span><span class="stat-label">Progress</span></div>
                </div>
                <div class="progress-bar"><div class="progress-fill" style="width: ${progress}%;"></div></div>
                ${sprintTasks.length > 0 ? `
                    <div class="sprint-tasks-preview">
                        <h4>Tasks (${sprintTasks.length})</h4>
                        <div class="preview-list">
                            ${sprintTasks.slice(0, 3).map(task => `
                                <div class="preview-item"><span>${task.title}</span><span class="priority-badge ${task.priority || 'medium'}">${task.priority || 'Medium'}</span></div>
                            `).join('')}
                            ${sprintTasks.length > 3 ? `<div class="preview-item">+${sprintTasks.length - 3} more...</div>` : ''}
                        </div>
                    </div>
                ` : ''}
            </div>
        `;
    });
    container.innerHTML = html;
}

function renderBacklog() {
    const list = document.getElementById('backlog-list');
    const tasks = JSON.parse(localStorage.getItem('tasks')) || [];
    const projects = JSON.parse(localStorage.getItem('projects')) || [];
    if (!list) return;
    let backlogTasks = tasks.filter(t => t.status === 'todo');
    const priorityFilter = document.querySelector('.backlog-filters .filter-btn.active')?.dataset.backlogFilter || 'all';
    if (priorityFilter !== 'all') backlogTasks = backlogTasks.filter(t => t.priority === priorityFilter);
    const searchInput = document.getElementById('backlogSearch');
    if (searchInput && searchInput.value.trim()) {
        const term = searchInput.value.toLowerCase().trim();
        backlogTasks = backlogTasks.filter(t => t.title.toLowerCase().includes(term));
    }
    document.getElementById('backlog-total').textContent = backlogTasks.length;
    document.getElementById('backlog-high-count').textContent = tasks.filter(t => t.status === 'todo' && t.priority === 'high').length;
    const today = new Date().toISOString().split('T')[0];
    const overdue = tasks.filter(t => t.status === 'todo' && t.dueDate && t.dueDate < today);
    document.getElementById('backlog-overdue').textContent = overdue.length;
    if (backlogTasks.length === 0) {
        list.innerHTML = '<p class="empty-message">No backlog items</p>';
        return;
    }
    let html = '';
    backlogTasks.forEach(task => {
        const project = projects.find(p => p.id === task.projectId);
        const projectName = project ? project.name : 'No Project';
        const isOverdue = task.dueDate && task.dueDate < today;
        html += `
            <div class="backlog-item" onclick="openEditTask('${task.id}')">
                <input type="checkbox" class="task-checkbox" onchange="event.stopPropagation(); toggleTaskStatus('${task.id}')" ${task.status === 'done' ? 'checked' : ''}>
                <div class="backlog-content">
                    <div class="backlog-title">${task.title}</div>
                    <div class="backlog-meta">
                        <span><i class="fas fa-folder"></i> ${projectName}</span>
                        <span><i class="fas fa-user"></i> ${task.assignee || 'Unassigned'}</span>
                        ${task.dueDate ? `<span><i class="far fa-calendar"></i> ${formatDate(task.dueDate)}</span>` : ''}
                        ${isOverdue ? `<span class="overdue-badge">⚠️ Overdue</span>` : ''}
                    </div>
                </div>
                <span class="priority-badge ${task.priority || 'medium'}">${task.priority || 'Medium'}</span>
                <div class="backlog-actions">
                    <button class="action-btn" onclick="event.stopPropagation(); openEditTask('${task.id}')"><i class="fas fa-edit"></i></button>
                    <button class="action-btn delete" onclick="event.stopPropagation(); deleteTask('${task.id}')"><i class="fas fa-trash"></i></button>
                </div>
            </div>
        `;
    });
    list.innerHTML = html;
}

document.addEventListener('click', function(e) {
    const filterBtn = e.target.closest('.backlog-filters .filter-btn');
    if (filterBtn) {
        document.querySelectorAll('.backlog-filters .filter-btn').forEach(b => b.classList.remove('active'));
        filterBtn.classList.add('active');
        renderBacklog();
    }
});

document.addEventListener('input', function(e) {
    const searchInput = e.target.closest('#backlogSearch');
    if (searchInput) renderBacklog();
});

function setupCharts() {
    const burndownCtx = document.getElementById('burndownChart');
    if (burndownCtx) {
        burndownChart = new Chart(burndownCtx, {
            type: 'line',
            data: {
                labels: ['Day 1', 'Day 2', 'Day 3', 'Day 4', 'Day 5', 'Day 6', 'Day 7', 'Day 8', 'Day 9', 'Day 10'],
                datasets: [
                    { label: 'Ideal', data: [20, 18, 16, 14, 12, 10, 8, 6, 4, 2], borderColor: '#94a3b8', borderDash: [5, 5], fill: false },
                    { label: 'Actual', data: [20, 19, 17, 14, 12, 9, 7, 5, 3, 1], borderColor: '#2563eb', backgroundColor: 'rgba(37,99,235,0.1)', fill: true }
                ]
            },
            options: { responsive: true, maintainAspectRatio: false }
        });
    }
    const statusCtx = document.getElementById('statusChart');
    if (statusCtx) {
        const tasks = JSON.parse(localStorage.getItem('tasks')) || [];
        const todo = tasks.filter(t => t.status === 'todo').length;
        const progress = tasks.filter(t => t.status === 'progress').length;
        const review = tasks.filter(t => t.status === 'review').length;
        const done = tasks.filter(t => t.status === 'done').length;
        statusChart = new Chart(statusCtx, {
            type: 'doughnut',
            data: {
                labels: ['To Do', 'In Progress', 'Review', 'Done'],
                datasets: [{ data: [todo, progress, review, done], backgroundColor: ['#94a3b8', '#2563eb', '#f59e0b', '#10b981'] }]
            },
            options: { responsive: true, maintainAspectRatio: false }
        });
    }
    const distCtx = document.getElementById('reportDistChart');
    if (distCtx) {
        reportDistChart = new Chart(distCtx, {
            type: 'bar',
            data: {
                labels: ['To Do', 'In Progress', 'Review', 'Done'],
                datasets: [{ label: 'Tasks', data: [0, 0, 0, 0], backgroundColor: ['#94a3b8', '#2563eb', '#f59e0b', '#10b981'] }]
            },
            options: { responsive: true, maintainAspectRatio: false }
        });
    }
    const rateCtx = document.getElementById('reportRateChart');
    if (rateCtx) {
        reportRateChart = new Chart(rateCtx, {
            type: 'pie',
            data: {
                labels: ['Completed', 'Remaining'],
                datasets: [{ data: [0, 0], backgroundColor: ['#10b981', '#e2e8f0'] }]
            },
            options: { responsive: true, maintainAspectRatio: false }
        });
    }
}

function updateCharts() {
    const tasks = JSON.parse(localStorage.getItem('tasks')) || [];
    const todo = tasks.filter(t => t.status === 'todo').length;
    const progress = tasks.filter(t => t.status === 'progress').length;
    const review = tasks.filter(t => t.status === 'review').length;
    const done = tasks.filter(t => t.status === 'done').length;
    const total = tasks.length;
    if (statusChart) {
        statusChart.data.datasets[0].data = [todo, progress, review, done];
        statusChart.update();
    }
    if (reportDistChart) {
        reportDistChart.data.datasets[0].data = [todo, progress, review, done];
        reportDistChart.update();
    }
    if (reportRateChart) {
        reportRateChart.data.datasets[0].data = [done, total - done];
        reportRateChart.update();
    }
}

function updateReports() { updateCharts(); }

window.openEditProject = function(projectId) {
    const projects = JSON.parse(localStorage.getItem('projects')) || [];
    const project = projects.find(p => p.id === projectId);
    if (!project) { showNotification('Project not found', 'warning'); return; }
    document.getElementById('projectModalTitle').textContent = 'Edit Project';
    document.getElementById('projectId').value = project.id;
    document.getElementById('projectName').value = project.name;
    document.getElementById('projectDescription').value = project.description || '';
    document.getElementById('projectStatus').value = project.status || 'active';
    document.getElementById('projectModal').classList.add('active');
    document.getElementById('overlay').classList.add('active');
};

window.deleteProject = function(projectId) {
    if (!confirm('Delete this project? All related tasks will be removed.')) return;
    let projects = JSON.parse(localStorage.getItem('projects')) || [];
    projects = projects.filter(p => p.id !== projectId);
    localStorage.setItem('projects', JSON.stringify(projects));
    let tasks = JSON.parse(localStorage.getItem('tasks')) || [];
    tasks = tasks.filter(t => t.projectId !== projectId);
    localStorage.setItem('tasks', JSON.stringify(tasks));
    updateUI();
    showNotification('Project deleted!', 'success');
};

window.openEditTask = function(taskId) {
    const tasks = JSON.parse(localStorage.getItem('tasks')) || [];
    const task = tasks.find(t => t.id === taskId);
    if (!task) { showNotification('Task not found', 'warning'); return; }
    document.getElementById('taskModalTitle').textContent = 'Edit Task';
    document.getElementById('taskId').value = task.id;
    document.getElementById('taskTitle').value = task.title;
    document.getElementById('taskDescription').value = task.description || '';
    document.getElementById('taskStatus').value = task.status || 'todo';
    document.getElementById('taskPriority').value = task.priority || 'medium';
    populateProjectSelect();
    document.getElementById('taskProject').value = task.projectId || '';
    document.getElementById('taskAssignee').value = task.assignee || 'John Doe';
    document.getElementById('taskDueDate').value = task.dueDate || '';
    document.getElementById('taskModal').classList.add('active');
    document.getElementById('overlay').classList.add('active');
};

window.deleteTask = function(taskId) {
    if (!confirm('Delete this task?')) return;
    let tasks = JSON.parse(localStorage.getItem('tasks')) || [];
    tasks = tasks.filter(t => t.id !== taskId);
    localStorage.setItem('tasks', JSON.stringify(tasks));
    updateUI();
    showNotification('Task deleted!', 'success');
};

window.openEditSprint = function(sprintId) {
    const sprints = JSON.parse(localStorage.getItem('sprints')) || [];
    const sprint = sprints.find(s => s.id === sprintId);
    if (!sprint) { showNotification('Sprint not found', 'warning'); return; }
    populateSprintProjectSelect();
    document.getElementById('sprintModalTitle').textContent = 'Edit Sprint';
    document.getElementById('sprintId').value = sprint.id;
    document.getElementById('sprintName').value = sprint.name;
    document.getElementById('sprintGoal').value = sprint.goal || '';
    document.getElementById('sprintStartDate').value = sprint.startDate || '';
    document.getElementById('sprintEndDate').value = sprint.endDate || '';
    document.getElementById('sprintStatus').value = sprint.status || 'planning';
    document.getElementById('sprintProject').value = sprint.projectId || '';
    document.getElementById('sprintModal').classList.add('active');
    document.getElementById('overlay').classList.add('active');
};

window.deleteSprint = function(sprintId) {
    if (!confirm('Delete this sprint? All related tasks will be removed.')) return;
    let sprints = JSON.parse(localStorage.getItem('sprints')) || [];
    sprints = sprints.filter(s => s.id !== sprintId);
    localStorage.setItem('sprints', JSON.stringify(sprints));
    let tasks = JSON.parse(localStorage.getItem('tasks')) || [];
    tasks = tasks.filter(t => t.sprintId !== sprintId);
    localStorage.setItem('tasks', JSON.stringify(tasks));
    updateUI();
    showNotification('Sprint deleted!', 'success');
};

window.toggleTaskStatus = function(taskId) {
    let tasks = JSON.parse(localStorage.getItem('tasks')) || [];
    tasks = tasks.map(t => {
        if (t.id === taskId) {
            const newStatus = t.status === 'done' ? 'todo' : 'done';
            return { ...t, status: newStatus };
        }
        return t;
    });
    localStorage.setItem('tasks', JSON.stringify(tasks));
    updateUI();
    showNotification('Task status updated!', 'success');
};

function openSprintModal(editId = null) {
    const modal = document.getElementById('sprintModal');
    const overlay = document.getElementById('overlay');
    if (!modal || !overlay) return;
    populateSprintProjectSelect();
    if (editId) {
        const sprints = JSON.parse(localStorage.getItem('sprints')) || [];
        const sprint = sprints.find(s => s.id === editId);
        if (sprint) {
            document.getElementById('sprintModalTitle').textContent = 'Edit Sprint';
            document.getElementById('sprintId').value = sprint.id;
            document.getElementById('sprintName').value = sprint.name;
            document.getElementById('sprintGoal').value = sprint.goal || '';
            document.getElementById('sprintStartDate').value = sprint.startDate || '';
            document.getElementById('sprintEndDate').value = sprint.endDate || '';
            document.getElementById('sprintStatus').value = sprint.status || 'planning';
            document.getElementById('sprintProject').value = sprint.projectId || '';
        }
    } else {
        document.getElementById('sprintModalTitle').textContent = 'Create New Sprint';
        document.getElementById('sprintId').value = '';
        document.getElementById('sprintForm').reset();
        const today = new Date();
        const nextWeek = new Date(today);
        nextWeek.setDate(nextWeek.getDate() + 14);
        document.getElementById('sprintStartDate').value = today.toISOString().split('T')[0];
        document.getElementById('sprintEndDate').value = nextWeek.toISOString().split('T')[0];
    }
    modal.classList.add('active');
    overlay.classList.add('active');
}

document.addEventListener('click', function(e) {
    const btn = e.target.closest('#createProjectBtn, #addProjectBtn');
    if (btn) {
        e.preventDefault();
        document.getElementById('projectModalTitle').textContent = 'Create New Project';
        document.getElementById('projectId').value = '';
        document.getElementById('projectForm').reset();
        document.getElementById('projectModal').classList.add('active');
        document.getElementById('overlay').classList.add('active');
    }
});

document.addEventListener('click', function(e) {
    const btn = e.target.closest('#createTaskBtn, #tasksAddBtn, #boardAddBtn, #addTaskBtn');
    if (btn) {
        e.preventDefault();
        document.getElementById('taskModalTitle').textContent = 'Create New Task';
        document.getElementById('taskId').value = '';
        document.getElementById('taskForm').reset();
        populateProjectSelect();
        document.getElementById('taskModal').classList.add('active');
        document.getElementById('overlay').classList.add('active');
    }
});

document.addEventListener('click', function(e) {
    const btn = e.target.closest('#addSprintBtn');
    if (btn) {
        e.preventDefault();
        openSprintModal();
    }
});

document.addEventListener('submit', function(e) {
    const form = e.target.closest('#sprintForm');
    if (form) {
        e.preventDefault();
        const id = document.getElementById('sprintId').value;
        const name = document.getElementById('sprintName').value;
        const goal = document.getElementById('sprintGoal').value;
        const startDate = document.getElementById('sprintStartDate').value;
        const endDate = document.getElementById('sprintEndDate').value;
        const status = document.getElementById('sprintStatus').value;
        const projectId = document.getElementById('sprintProject').value;
        if (!name) { alert('Please enter sprint name'); return; }
        if (!startDate || !endDate) { alert('Please enter start and end dates'); return; }
        if (!projectId) { alert('Please select a project'); return; }
        let sprints = JSON.parse(localStorage.getItem('sprints')) || [];
        if (id) {
            sprints = sprints.map(s => {
                if (s.id === id) return { ...s, name, goal, startDate, endDate, status, projectId };
                return s;
            });
            showNotification('Sprint updated successfully!', 'success');
        } else {
            const newSprint = {
                id: 'sprint_' + Date.now(),
                name, goal, startDate, endDate, status, projectId,
                tasks: [],
                createdAt: new Date().toISOString()
            };
            sprints.push(newSprint);
            showNotification('Sprint created successfully!', 'success');
        }
        localStorage.setItem('sprints', JSON.stringify(sprints));
        document.getElementById('sprintModal').classList.remove('active');
        document.getElementById('overlay').classList.remove('active');
        updateUI();
    }
});

document.addEventListener('submit', function(e) {
    const form = e.target.closest('#projectForm');
    if (form) {
        e.preventDefault();
        const id = document.getElementById('projectId').value;
        const name = document.getElementById('projectName').value;
        const description = document.getElementById('projectDescription').value;
        const status = document.getElementById('projectStatus').value;
        if (!name) { alert('Please enter project name'); return; }
        let projects = JSON.parse(localStorage.getItem('projects')) || [];
        if (id) {
            projects = projects.map(p => { if (p.id === id) return { ...p, name, description, status }; return p; });
        } else {
            projects.push({ id: 'project_' + Date.now(), name, description, status, createdAt: new Date().toISOString() });
        }
        localStorage.setItem('projects', JSON.stringify(projects));
        document.getElementById('projectModal').classList.remove('active');
        document.getElementById('overlay').classList.remove('active');
        showNotification('Project saved!', 'success');
        updateUI();
    }
});

document.addEventListener('submit', function(e) {
    const form = e.target.closest('#taskForm');
    if (form) {
        e.preventDefault();
        const id = document.getElementById('taskId').value;
        const title = document.getElementById('taskTitle').value;
        const description = document.getElementById('taskDescription').value;
        const projectId = document.getElementById('taskProject').value;
        const status = document.getElementById('taskStatus').value;
        const priority = document.getElementById('taskPriority').value;
        const assignee = document.getElementById('taskAssignee').value;
        const dueDate = document.getElementById('taskDueDate').value;
        if (!title) { alert('Please enter task title'); return; }
        if (!projectId) { alert('Please select a project'); return; }
        let tasks = JSON.parse(localStorage.getItem('tasks')) || [];
        if (id) {
            tasks = tasks.map(t => { if (t.id === id) return { ...t, title, description, projectId, status, priority, assignee, dueDate }; return t; });
        } else {
            tasks.push({
                id: 'task_' + Date.now(),
                title, description, projectId, status, priority, assignee, dueDate,
                createdAt: new Date().toISOString()
            });
        }
        localStorage.setItem('tasks', JSON.stringify(tasks));
        document.getElementById('taskModal').classList.remove('active');
        document.getElementById('overlay').classList.remove('active');
        showNotification('Task saved!', 'success');
        updateUI();
    }
});

document.addEventListener('click', function(e) {
    const cancelBtn = e.target.closest('.modal .btn-secondary, .modal .close-btn, #cancelModal, #cancelProjectModal, #cancelSprintModal, #cancelTaskModal');
    if (cancelBtn) {
        const modal = cancelBtn.closest('.modal');
        if (modal) modal.classList.remove('active');
        document.getElementById('overlay')?.classList.remove('active');
    }
    const overlay = e.target.closest('#overlay');
    if (overlay) {
        document.querySelectorAll('.modal.active').forEach(m => m.classList.remove('active'));
        overlay.classList.remove('active');
    }
});

document.addEventListener('click', function(e) {
    const navItem = e.target.closest('.nav-item[data-section]');
    if (navItem) {
        e.preventDefault();
        const sectionName = navItem.dataset.section;
        switchTab(sectionName);
    }
});

document.addEventListener('click', function(e) {
    const filterBtn = e.target.closest('.filter-btn');
    if (filterBtn) {
        document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
        filterBtn.classList.add('active');
        renderTasksList();
    }
});

document.addEventListener('click', function(e) {
    const toggle = e.target.closest('#sidebarToggle');
    if (toggle) {
        const sidebar = document.getElementById('sidebar');
        if (sidebar) {
            sidebar.classList.toggle('collapsed');
            const icon = toggle.querySelector('i');
            if (sidebar.classList.contains('collapsed')) {
                icon.classList.remove('fa-chevron-left');
                icon.classList.add('fa-chevron-right');
                localStorage.setItem('sidebarCollapsed', 'true');
            } else {
                icon.classList.remove('fa-chevron-right');
                icon.classList.add('fa-chevron-left');
                localStorage.setItem('sidebarCollapsed', 'false');
            }
        }
    }
});

document.addEventListener('change', function(e) {
    const themeSelect = e.target.closest('#themeSelect');
    if (themeSelect) {
        const value = themeSelect.value;
        if (value === 'dark') {
            document.body.classList.add('dark-theme');
            localStorage.setItem('theme', 'dark');
            document.querySelector('.theme-toggle i').className = 'fas fa-sun';
        } else {
            document.body.classList.remove('dark-theme');
            localStorage.setItem('theme', 'light');
            document.querySelector('.theme-toggle i').className = 'fas fa-moon';
        }
    }
});

document.addEventListener('click', function(e) {
    const themeBtn = e.target.closest('.theme-toggle');
    if (themeBtn) {
        const isDark = document.body.classList.toggle('dark-theme');
        const icon = themeBtn.querySelector('i');
        if (isDark) {
            icon.className = 'fas fa-sun';
            localStorage.setItem('theme', 'dark');
        } else {
            icon.className = 'fas fa-moon';
            localStorage.setItem('theme', 'light');
        }
        const themeSelect = document.getElementById('themeSelect');
        if (themeSelect) themeSelect.value = isDark ? 'dark' : 'light';
    }
});

document.addEventListener('click', function(e) {
    const menuToggle = e.target.closest('#menuToggle');
    if (menuToggle) {
        const sidebar = document.getElementById('sidebar');
        if (sidebar) {
            sidebar.classList.toggle('show');
            const icon = menuToggle.querySelector('i');
            if (sidebar.classList.contains('show')) {
                icon.classList.remove('fa-bars');
                icon.classList.add('fa-times');
            } else {
                icon.classList.remove('fa-times');
                icon.classList.add('fa-bars');
            }
        }
    }
});

document.addEventListener('scroll', function() {
    const btn = document.getElementById('scrollToTop');
    if (btn) {
        if (window.scrollY > 300) btn.classList.add('show');
        else btn.classList.remove('show');
    }
});

document.addEventListener('click', function(e) {
    const scrollBtn = e.target.closest('#scrollToTop');
    if (scrollBtn) window.scrollTo({ top: 0, behavior: 'smooth' });
});

document.addEventListener('click', function(e) {
    const notifBtn = e.target.closest('.notification-btn');
    if (notifBtn) {
        const tasks = JSON.parse(localStorage.getItem('tasks')) || [];
        const pending = tasks.filter(t => t.status !== 'done').length;
        showNotification(`You have ${pending} tasks pending`, pending > 0 ? 'warning' : 'info');
    }
});

document.addEventListener('click', function(e) {
    const logoutBtn = e.target.closest('#logoutBtn');
    if (logoutBtn) {
        e.preventDefault();
        if (auth) {
            auth.signOut();
            localStorage.clear();
            window.location.href = 'front.html';
        }
    }
});

(function loadSavedSettings() {
    if (localStorage.getItem('sidebarCollapsed') === 'true') {
        const sidebar = document.getElementById('sidebar');
        if (sidebar) sidebar.classList.add('collapsed');
    }
    if (localStorage.getItem('theme') === 'dark') {
        document.body.classList.add('dark-theme');
        const themeSelect = document.getElementById('themeSelect');
        if (themeSelect) themeSelect.value = 'dark';
    }
})();

(function addDynamicStyles() {
    const style = document.createElement('style');
    style.textContent = `
        .notification {
            position: fixed; top: 20px; right: 20px; padding: 12px 20px;
            background: white; border-radius: 8px; box-shadow: 0 4px 12px rgba(0,0,0,0.15);
            display: flex; align-items: center; gap: 10px; z-index: 9999;
            border-left: 4px solid; animation: slideIn 0.3s ease;
            max-width: 350px;
        }
        .notification.warning { border-left-color: #f59e0b; }
        .notification.success { border-left-color: #10b981; }
        .notification.info { border-left-color: #2563eb; }
        @keyframes slideIn { from { transform: translateX(100%); opacity: 0; } to { transform: translateX(0%); opacity: 1; } }
        .loading { opacity: 0.7; pointer-events: none; position: relative; }
        .loading::after {
            content: ''; position: absolute; width: 20px; height: 20px;
            top: 50%; left: 50%; transform: translate(-50%, -50%);
            border: 2px solid white; border-top-color: transparent;
            border-radius: 50%; animation: spin 1s linear infinite;
        }
        @keyframes spin { to { transform: translate(-50%, -50%) rotate(360deg); } }
    `;
    document.head.appendChild(style);
})();

document.addEventListener('DOMContentLoaded', async function() {
    console.log('📄 DOM loaded');
    await waitForFirebase();
    window.auth.onAuthStateChanged((user) => {
        console.log('🔐 Auth state changed:', user ? user.email : 'No user');
        if (user) {
            currentUser = user;
            const userName = user.displayName || user.email.split('@')[0];
            localStorage.setItem('userName', userName);
            localStorage.setItem('userEmail', user.email);
            if (document.getElementById('loginForm')) {
                console.log('🔄 Redirecting to web.html');
                window.location.href = 'web.html';
            }
        } else {
            currentUser = null;
            if (!document.getElementById('loginForm')) {
                console.log('🔄 Redirecting to front.html');
                window.location.href = 'front.html';
            }
        }
    });
});

loadApp();
console.log('🎯 web.js ready');
