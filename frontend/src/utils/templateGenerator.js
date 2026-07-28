// Utility to generate sample Excel/CSV templates for bulk upload

function downloadCSV(filename, content) {
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

export const downloadStudentsTemplate = () => {
  const content = `regno,name,dept,subject_code,batch,degree
950001,John Doe,CSE,CS8591,2022-2026,B.E.
950002,Jane Smith,ECE,EC8551,2022-2026,B.E.
950003,Robert Brown,MECH,ME8592,2022-2026,B.E.`;
  downloadCSV('students_template.csv', content);
};

export const downloadSubjectsTemplate = () => {
  const content = `subject_code,subject_name,batch
CS8591,Computer Networks,2022-2026
EC8551,Communication Networks,2022-2026
ME8592,Thermal Engineering,2022-2026`;
  downloadCSV('subjects_template.csv', content);
};

export const downloadHallsTemplate = () => {
  const content = `hall_no,capacity,block
101,24,Main Block
102,30,Science Block
103,24,IT Block`;
  downloadCSV('halls_template.csv', content);
};

export const downloadInvigilatorsTemplate = () => {
  const content = `name,dept
Dr. Alan Turing,CSE
Prof. Grace Hopper,ECE
Dr. Nikola Tesla,MECH`;
  downloadCSV('invigilators_template.csv', content);
};
