import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { Layout } from '@/components/Layout'
import { CourseListPage } from '@/pages/CourseListPage'
import { CourseDetailPage } from '@/pages/CourseDetailPage'
import { CreateCoursePage } from '@/pages/CreateCoursePage'

export function App() {
  return (
    <BrowserRouter>
      <Layout>
        <Routes>
          <Route path="/" element={<CourseListPage />} />
          <Route path="/courses/new" element={<CreateCoursePage />} />
          <Route path="/courses/:id" element={<CourseDetailPage />} />
        </Routes>
      </Layout>
    </BrowserRouter>
  )
}
