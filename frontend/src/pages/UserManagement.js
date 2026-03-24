import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Plus, Building2 } from 'lucide-react';

import { Button } from '../components/ui/button';
import { Card } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from '../components/ui/dialog';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { api } from '../App';
import { toast } from 'sonner';

export default function UserManagement({ user }) {
  const [users, setUsers] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isUserDialogOpen, setIsUserDialogOpen] = useState(false);
  const [isDeptDialogOpen, setIsDeptDialogOpen] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [editingDept, setEditingDept] = useState(null);
  const [userFormData, setUserFormData] = useState({
    name: '',
    email: '',
    phone: '',
    department: '',
    role: 'member',
  });
  const [deptFormData, setDeptFormData] = useState({ name: '' });

  const isAdmin = user?.role === 'admin';

  useEffect(() => {
    console.log('User role:', user?.role, 'isAdmin:', isAdmin);
    loadUsers();
    loadDepartments();
  }, []);

  const loadUsers = async () => {
    try {
      const response = await api.get('/users');
      setUsers(response.data);
    } catch (error) {
      toast.error('Failed to load users');
    } finally {
      setLoading(false);
    }
  };

  const loadDepartments = async () => {
    try {
      const response = await api.get('/departments');
      setDepartments(response.data);
    } catch (error) {
      toast.error('Failed to load departments');
    }
  };

  const handleUserSubmit = async () => {
    if (!userFormData.name || (!userFormData.email && !userFormData.phone)) {
      toast.error('Please fill in name and either email or phone');
      return;
    }

    if (!userFormData.department) {
      toast.error('Please select a department');
      return;
    }

    try {
      if (editingUser) {
        await api.put(`/users/${editingUser.id}`, userFormData);
        toast.success('User updated successfully');
      } else {
        await api.post('/users', userFormData);
        toast.success('User added successfully');
      }
      setIsUserDialogOpen(false);
      resetUserForm();
      loadUsers();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to save user');
    }
  };

  const handleUserEdit = (user) => {
    setEditingUser(user);
    setUserFormData({
      name: user.name,
      email: user.email || '',
      phone: user.phone || '',
      department: user.department,
      role: user.role,
    });
    setIsUserDialogOpen(true);
  };

  const handleUserDelete = async (userId) => {
    if (!window.confirm('Are you sure you want to delete this user?')) return;
    
    try {
      await api.delete(`/users/${userId}`);
      toast.success('User deleted successfully');
      loadUsers();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to delete user');
    }
  };

  const handleDeptSubmit = async () => {
    if (!deptFormData.name) {
      toast.error('Please enter department name');
      return;
    }

    try {
      if (editingDept) {
        await api.put(`/departments/${editingDept.id}`, deptFormData);
        toast.success('Department updated successfully');
      } else {
        await api.post('/departments', deptFormData);
        toast.success('Department created successfully');
      }
      setIsDeptDialogOpen(false);
      setDeptFormData({ name: '' });
      setEditingDept(null);
      loadDepartments();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to save department');
    }
  };

  const handleDeptEdit = (dept) => {
    setEditingDept(dept);
    setDeptFormData({ name: dept.name });
    setIsDeptDialogOpen(true);
  };

  const handleDeptDelete = async (deptId) => {
    if (!window.confirm('Are you sure you want to delete this department?')) return;
    
    try {
      await api.delete(`/departments/${deptId}`);
      toast.success('Department deleted successfully');
      loadDepartments();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to delete department');
    }
  };

  const resetUserForm = () => {
    setUserFormData({
      name: '',
      email: '',
      phone: '',
      department: '',
      role: 'member',
    });
    setEditingUser(null);
  };

  return (

      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-4xl font-heading font-bold tracking-tight" data-testid="users-heading">
              Team Management
            </h1>
            <p className="text-muted-foreground mt-2">Manage team members and departments</p>
          </div>
        </div>

        <Tabs defaultValue="users" className="space-y-6">
          <TabsList>
            <TabsTrigger value="users" data-testid="users-tab">Team Members</TabsTrigger>
            <TabsTrigger value="departments" data-testid="departments-tab">Departments</TabsTrigger>
          </TabsList>

          <TabsContent value="users" className="space-y-6">
            {isAdmin && (
              <div className="flex justify-end">
                <Dialog
                  open={isUserDialogOpen}
                  onOpenChange={(open) => {
                    setIsUserDialogOpen(open);
                    if (!open) resetUserForm();
                  }}
                >
                  <DialogTrigger asChild>
                    <Button data-testid="add-user-button">
                      <Plus className="mr-2 h-4 w-4" />
                      Add Member
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-md">
                    <DialogHeader>
                      <DialogTitle>{editingUser ? 'Edit Team Member' : 'Add New Team Member'}</DialogTitle>
                      <DialogDescription className="sr-only">
                        Enter the details for the team member here.
                      </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 mt-4">
                      <div>
                        <Label htmlFor="name">Name *</Label>
                        <Input
                          id="name"
                          value={userFormData.name}
                          onChange={(e) => setUserFormData({ ...userFormData, name: e.target.value })}
                          data-testid="user-name-input"
                        />
                      </div>
                      <div>
                        <Label htmlFor="email">Email</Label>
                        <Input
                          id="email"
                          type="email"
                          value={userFormData.email}
                          onChange={(e) => setUserFormData({ ...userFormData, email: e.target.value })}
                          data-testid="user-email-input"
                        />
                      </div>
                      <div>
                        <Label htmlFor="phone">Phone</Label>
                        <Input
                          id="phone"
                          type="tel"
                          value={userFormData.phone}
                          onChange={(e) => setUserFormData({ ...userFormData, phone: e.target.value })}
                          data-testid="user-phone-input"
                        />
                      </div>
                      <div>
                        <Label htmlFor="department">Department *</Label>
                        <Select
                          value={userFormData.department}
                          onValueChange={(value) => setUserFormData({ ...userFormData, department: value })}
                        >
                          <SelectTrigger data-testid="user-department-select">
                            <SelectValue placeholder="Select department" />
                          </SelectTrigger>
                          <SelectContent>
                            {departments.map((dept) => (
                              <SelectItem key={dept.id} value={dept.name}>
                                {dept.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label htmlFor="role">Role</Label>
                        <Select
                          value={userFormData.role}
                          onValueChange={(value) => setUserFormData({ ...userFormData, role: value })}
                        >
                          <SelectTrigger data-testid="user-role-select">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="member">Member</SelectItem>
                            <SelectItem value="manager">Manager</SelectItem>
                            <SelectItem value="admin">Admin</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <Button onClick={handleUserSubmit} className="w-full" data-testid="save-user-button">
                        {editingUser ? 'Update Member' : 'Add Member'}
                      </Button>
                    </div>
                  </DialogContent>
                </Dialog>
              </div>
            )}

            {!isAdmin && (
              <div className="flex justify-end">
                <p className="text-sm text-muted-foreground">Only admins can add members</p>
              </div>
            )}

            {loading ? (
              <div className="flex items-center justify-center h-64">
                <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6" data-testid="user-list">
                {users.map((u) => (
                  <motion.div
                    key={u.id}
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    data-testid={`user-card-${u.id}`}
                  >
                    <Card className="p-6 hover:shadow-lg transition-all duration-300">
                      <div className="flex items-center gap-4 mb-4">
                        <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                          <span className="text-lg font-heading font-bold text-primary">
                            {u.name.charAt(0).toUpperCase()}
                          </span>
                        </div>
                        <div className="flex-1">
                          <h3 className="font-heading font-semibold" data-testid="user-name">
                            {u.name}
                          </h3>
                          <p className="text-sm text-muted-foreground">{u.department}</p>
                        </div>
                      </div>
                      <div className="space-y-2 text-sm">
                        {u.email && (
                          <div className="flex items-center gap-2">
                            <span className="font-medium">Email:</span>
                            <span className="text-muted-foreground truncate">{u.email}</span>
                          </div>
                        )}
                        {u.phone && (
                          <div className="flex items-center gap-2">
                            <span className="font-medium">Phone:</span>
                            <span className="text-muted-foreground">{u.phone}</span>
                          </div>
                        )}
                        <div className="flex items-center gap-2">
                          <span className="font-medium">Role:</span>
                          <Badge variant="outline" className="capitalize">
                            {u.role}
                          </Badge>
                        </div>
                      </div>
                      {isAdmin && (
                        <div className="flex gap-2 mt-4">
                          <Button
                            variant="outline"
                            size="sm"
                            className="flex-1"
                            onClick={() => handleUserEdit(u)}
                            data-testid={`edit-user-${u.id}`}
                          >
                            Edit
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            className="flex-1"
                            onClick={() => handleUserDelete(u.id)}
                            data-testid={`delete-user-${u.id}`}
                          >
                            Delete
                          </Button>
                        </div>
                      )}
                    </Card>
                  </motion.div>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="departments" className="space-y-6">
            {isAdmin && (
              <div className="flex justify-end">
                <Dialog open={isDeptDialogOpen} onOpenChange={setIsDeptDialogOpen}>
                  <DialogTrigger asChild>
                    <Button data-testid="add-department-button">
                      <Plus className="mr-2 h-4 w-4" />
                      Add Department
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-md">
                    <DialogHeader>
                      <DialogTitle>{editingDept ? 'Edit Department' : 'Add New Department'}</DialogTitle>
                      <DialogDescription className="sr-only">
                        Enter the details for the department here.
                      </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 mt-4">
                      <div>
                        <Label htmlFor="dept-name">Department Name *</Label>
                        <Input
                          id="dept-name"
                          value={deptFormData.name}
                          onChange={(e) => setDeptFormData({ name: e.target.value })}
                          data-testid="department-name-input"
                        />
                      </div>
                      <Button onClick={handleDeptSubmit} className="w-full" data-testid="save-department-button">
                        {editingDept ? 'Update Department' : 'Add Department'}
                      </Button>
                    </div>
                  </DialogContent>
                </Dialog>
              </div>
            )}

            {!isAdmin && (
              <div className="flex justify-end">
                <p className="text-sm text-muted-foreground">Only admins can add departments</p>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6" data-testid="department-list">
              {departments.map((dept) => (
                <motion.div
                  key={dept.id}
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  data-testid={`department-card-${dept.id}`}
                >
                  <Card className="p-6 hover:shadow-lg transition-all duration-300">
                    <div className="flex items-center gap-4">
                      <div className="h-12 w-12 rounded-full bg-accent/10 flex items-center justify-center">
                        <Building2 className="h-6 w-6 text-accent" />
                      </div>
                      <div>
                        <h3 className="font-heading font-semibold text-lg" data-testid="department-name">
                          {dept.name}
                        </h3>
                        <p className="text-sm text-muted-foreground">
                          {users.filter((u) => u.department === dept.name).length} members
                        </p>
                      </div>
                    </div>
                    {isAdmin && (
                      <div className="flex gap-2 mt-4">
                        <Button
                          variant="outline"
                          size="sm"
                          className="flex-1"
                          onClick={() => handleDeptEdit(dept)}
                          data-testid={`edit-dept-${dept.id}`}
                        >
                          Edit
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="flex-1"
                          onClick={() => handleDeptDelete(dept.id)}
                          data-testid={`delete-dept-${dept.id}`}
                        >
                          Delete
                        </Button>
                      </div>
                    )}
                  </Card>
                </motion.div>
              ))}
            </div>
          </TabsContent>
        </Tabs>
      </div>
   
  );
}
