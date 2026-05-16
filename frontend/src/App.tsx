import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { Layout } from '@/components/Layout'
import { HomePage } from '@/pages/HomePage'
import { CourseListPage } from '@/pages/CourseListPage'
import { CourseDetailPage } from '@/pages/CourseDetailPage'
import { CreateCoursePage } from '@/pages/CreateCoursePage'
import { DiscoverPage } from '@/pages/DiscoverPage'
import { DataRefreshProvider } from '@/context/DataRefreshContext'
import { ReviewModalProvider } from '@/context/ReviewModalContext'

export function App() {
  return (
    <BrowserRouter>
      <DataRefreshProvider>
        <ReviewModalProvider>
          <Layout>
            <Routes>
              <Route path="/" element={<HomePage />} />
              <Route path="/search" element={<CourseListPage />} />
              <Route path="/discover" element={<DiscoverPage />} />
              <Route path="/courses/new" element={<CreateCoursePage />} />
              <Route path="/courses/:id" element={<CourseDetailPage />} />
            </Routes>
          </Layout>
        </ReviewModalProvider>
      </DataRefreshProvider>
    </BrowserRouter>
  )
}
