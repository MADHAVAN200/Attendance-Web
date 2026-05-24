import React from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import DashboardLayout from '../../components/DashboardLayout';
import EmployeeFormContent from '../../components/employees/EmployeeFormContent';

const EmployeeForm = () => {
    const navigate = useNavigate();
    const { id } = useParams();
    const isEditMode = !!id;

    const handleSuccess = () => {
        navigate('/employees');
    };

    const handleCancel = () => {
        navigate('/employees');
    };

    return (
        <DashboardLayout title={isEditMode ? "Edit Employee" : "Add New Employee"}>
            <div className="w-full">
                <EmployeeFormContent 
                    userId={id} 
                    onSuccess={handleSuccess} 
                    onCancel={handleCancel} 
                />
            </div>
        </DashboardLayout>
    );
};

export default EmployeeForm;
