const student = {
  student_id: "1",
  name: "Arjun",
  department: "CSE",
  year: 2,
  cgpa: 8.3,
  activities: [
    { activity_name: "Football", role: "Player", level: "College" },
    { activity_name: "Coding Club", role: "Member", level: "Intercollege" }
  ]
};

db.students.insertOne(student);

db.students.insertMany([
{
  student_id: "2",
  name: "Vishnu",
  department: "CSD",
  year: 2,
  cgpa: 8.7,
  activities: [
    { activity_name: "Football", role: "Player", level: "College" },
    { activity_name: "Coding Club", role: "Member", level: "Intercollege" }
  ]
},
{
  student_id: "3",
  name: "Meera",
  department: "ECE",
  year: 2,
  cgpa: 9.1,
  activities: [
    { activity_name: "Dance", role: "Performer", level: "State" }
  ]
}
]);

db.students.find({ cgpa: { $gt: 8.5 } });

db.students.updateOne(
  { student_id: "1", "activities.activity_name": "BasketBall" },
  { $set: { "activities.$.role": "Captain" } }
);

db.students.find({ student_id: { $gt: "1" } });
db.students.find()
