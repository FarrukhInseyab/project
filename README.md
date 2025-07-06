# Document AI Studio

A powerful AI-driven document processing platform that enables intelligent tag extraction, smart data mapping, and automated document generation.

## 🚀 Features

- **AI-Powered Tag Extraction**: Automatically extract tags from Word documents using £tag£ format
- **Smart Data Mapping**: Intelligent mapping between document tags and data sources
- **Template Management**: Create, organize, and reuse document templates
- **Batch Document Generation**: Generate multiple documents from array data
- **PoDAPI Integration**: Connect with ProofofDebitAPI for automated data processing
- **Cloud Storage**: Secure file storage with Supabase
- **PDF Generation**: Convert documents to PDF using CloudConvert
- **Real-time Collaboration**: Share templates and collaborate with team members

## 🛠️ Technology Stack

- **Frontend**: React 18, TypeScript, Tailwind CSS
- **Backend**: Supabase (PostgreSQL, Auth, Storage, RLS)
- **Document Processing**: Mammoth.js, Docxtemplater, PizZip
- **PDF Conversion**: CloudConvert API
- **Deployment**: Netlify
- **Icons**: Lucide React

## 📋 Prerequisites

- Node.js 18+ and npm
- Supabase account and project
- CloudConvert account (optional, for PDF generation)

## 🔧 Environment Setup

### 1. Supabase Configuration

1. Create a new Supabase project at [supabase.com](https://supabase.com)
2. Go to Settings > API to get your project URL and anon key
3. Run the database migrations in the Supabase SQL editor (found in `supabase/migrations/`)

### 2. Environment Variables

Create a `.env` file in the root directory:

```env
VITE_SUPABASE_URL=https://your-project-ref.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here
VITE_CLOUDCONVERT_API_KEY=your-cloudconvert-api-key (optional)
```

### 3. Netlify Deployment

#### Environment Variables in Netlify

Set these in your Netlify dashboard under Site settings > Environment variables:

- `VITE_SUPABASE_URL`: Your Supabase project URL
- `VITE_SUPABASE_ANON_KEY`: Your Supabase anon key
- `VITE_CLOUDCONVERT_API_KEY`: Your CloudConvert API key (optional)

#### Build Settings

- **Build command**: `npm run build`
- **Publish directory**: `dist`
- **Node version**: 18

## 🚀 Local Development

1. **Clone and install dependencies**:
   ```bash
   git clone <repository-url>
   cd document-ai-studio
   npm install
   ```

2. **Set up environment variables**:
   ```bash
   cp .env.example .env
   # Edit .env with your actual values
   ```

3. **Start development server**:
   ```bash
   npm run dev
   ```

4. **Open your browser**:
   Navigate to `http://localhost:5173`

## 📊 Database Schema

The application uses the following main tables:

- **profiles**: User profiles and preferences
- **document_templates**: Reusable document templates
- **template_tags**: Tags associated with templates
- **template_categories**: Template organization
- **document_generations**: History of generated documents
- **data_mappings**: AI-powered mapping suggestions
- **user_activity**: Activity tracking and analytics
- **template_sharing**: Template collaboration
- **ProofofDebitAPI**: External API integration

## 🔐 Security Features

- **Row Level Security (RLS)**: Database-level security policies
- **User Isolation**: Users can only access their own data
- **Secure File Storage**: Files stored in Supabase Storage with proper access controls
- **CORS Configuration**: Proper cross-origin resource sharing setup
- **Content Security Policy**: Protection against XSS attacks

## 🎯 Usage Guide

### 1. Document Upload
- Upload Word documents (.docx format)
- Use £tag_name£ format in your documents for automatic tag extraction
- The AI will automatically detect and extract tags

### 2. Tag Management
- Review and customize extracted tags
- Add descriptions and expected value types
- Create additional tags manually if needed

### 3. Data Import
- Import data via JSON, manual entry, or PoDAPI integration
- Smart auto-mapping between tags and data fields
- Support for both single and multi-document generation

### 4. Document Generation
- Generate populated DOCX documents instantly
- Optional PDF conversion via CloudConvert
- Batch processing for multiple documents
- Automatic file storage and download

### 5. Template Management
- Save document structures as reusable templates
- Organize templates by categories
- Share templates with team members
- Track usage analytics

## 🔧 Troubleshooting

### Common Issues

1. **Supabase Connection Errors**:
   - Verify your environment variables are correct
   - Check that your Supabase project is active
   - Ensure RLS policies are properly configured

2. **CORS Issues**:
   - Check your Netlify headers configuration
   - Verify CSP settings allow necessary domains
   - Use the fallback editor if OnlyOffice has CORS issues

3. **PDF Generation Fails**:
   - Verify your CloudConvert API key is valid
   - Check your CloudConvert account quota
   - Ensure your account email is verified

4. **File Upload Issues**:
   - Check Supabase Storage bucket policies
   - Verify file size limits (50MB default)
   - Ensure proper MIME type configuration

### Environment-Specific Issues

**Development (StackBlitz/WebContainer)**:
- OnlyOffice integration may have CORS limitations
- Use the fallback text editor for document editing
- All other features work normally

**Production (Netlify)**:
- Ensure all environment variables are set in Netlify dashboard
- Check build logs for any missing dependencies
- Verify domain configuration for external API calls

## 📈 Performance Optimization

- **Lazy Loading**: Components loaded on demand
- **Image Optimization**: Automatic image compression and caching
- **Database Indexing**: Optimized queries with proper indexes
- **CDN Caching**: Static assets cached via Netlify CDN
- **Bundle Splitting**: Optimized JavaScript bundles

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🆘 Support

For support and questions:

1. Check the troubleshooting section above
2. Review the GitHub issues
3. Contact the development team

## 🔄 Updates and Maintenance

- Regular dependency updates
- Security patches applied promptly
- Feature enhancements based on user feedback
- Performance monitoring and optimization

---

Built with ❤️ using modern web technologies for enterprise-grade document processing.