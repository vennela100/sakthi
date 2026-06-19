from django import forms  # type: ignore
from django.contrib.auth.forms import UserCreationForm, AuthenticationForm  # type: ignore
from accounts.models import CustomUser, EmergencyContact, CommunityReport, SOSAlert  # type: ignore


class RegisterForm(UserCreationForm):
    """Registration form with name, phone number, and password fields."""
    first_name = forms.CharField(
        max_length=100,
        widget=forms.TextInput(attrs={
            'class': 'form-control-premium',
            'placeholder': 'Enter your full name',
            'id': 'id_first_name',
        })
    )
    phone_number = forms.CharField(
        max_length=15,
        widget=forms.TextInput(attrs={
            'class': 'form-control-premium',
            'placeholder': 'Enter your phone number',
            'id': 'id_phone_number',
        })
    )
    username = forms.CharField(
        max_length=150,
        widget=forms.TextInput(attrs={
            'class': 'form-control-premium',
            'placeholder': 'Choose a username',
            'id': 'id_username',
        })
    )
    password1 = forms.CharField(
        widget=forms.PasswordInput(attrs={
            'class': 'form-control-premium',
            'placeholder': 'Create a password',
            'id': 'id_password1',
        })
    )
    password2 = forms.CharField(
        widget=forms.PasswordInput(attrs={
            'class': 'form-control-premium',
            'placeholder': 'Confirm your password',
            'id': 'id_password2',
        })
    )

    class Meta:
        model = CustomUser
        fields = ['first_name', 'phone_number', 'username', 'password1', 'password2']

    def save(self, commit=True):
        user = super().save(commit=False)
        user.first_name = self.cleaned_data['first_name']
        user.phone_number = self.cleaned_data['phone_number']
        if commit:
            user.save()
        return user


class LoginForm(AuthenticationForm):
    """Login form with modern labels and placeholders for Notion-style UI."""
    username = forms.CharField(
        label="Username or email",
        widget=forms.TextInput(attrs={
            'class': 'form-control-notion',
            'placeholder': 'Enter your username or email address...',
            'id': 'id_login_email',
        })
    )
    password = forms.CharField(
        label="Password",
        widget=forms.PasswordInput(attrs={
            'class': 'form-control-notion',
            'placeholder': 'Enter your password...',
            'id': 'id_login_password',
        })
    )

    def clean(self):
        login_value = self.cleaned_data.get('username')

        if login_value and '@' in login_value:
            user = CustomUser.objects.filter(email__iexact=login_value).first()
            if user:
                self.cleaned_data['username'] = user.get_username()

        return super().clean()


class ProfileDetailsForm(forms.ModelForm):
    """Step 1 of Profile Setup: Personal Details."""
    class Meta:
        model = CustomUser
        fields = ['first_name', 'phone_number', 'home_address', 'work_address', 'profile_picture']
        widgets = {
            'first_name': forms.TextInput(attrs={'class': 'form-control-premium', 'placeholder': 'Full Name'}),
            'phone_number': forms.TextInput(attrs={'class': 'form-control-premium', 'placeholder': 'Phone Number'}),
            'home_address': forms.TextInput(attrs={'class': 'form-control-premium', 'placeholder': 'Home Address (optional)'}),
            'work_address': forms.TextInput(attrs={'class': 'form-control-premium', 'placeholder': 'Work Address (optional)'}),
            'profile_picture': forms.ClearableFileInput(attrs={'class': 'form-control-premium'}),
        }


class EmergencyContactSetupForm(forms.ModelForm):
    """Step 2 of Profile Setup: Emergency Contacts."""
    class Meta:
        model = EmergencyContact
        fields = ['contact_name', 'phone_number', 'relationship']
        widgets = {
            'contact_name': forms.TextInput(attrs={'class': 'form-control-premium', 'placeholder': 'Contact Name'}),
            'phone_number': forms.TextInput(attrs={'class': 'form-control-premium', 'placeholder': 'Phone Number'}),
            'relationship': forms.TextInput(attrs={'class': 'form-control-premium', 'placeholder': 'Relationship (e.g. Mother, Friend)'}),
        }


class EmergencyContactForm(forms.ModelForm):
    """Standard form to add emergency contacts."""
    class Meta:
        model = EmergencyContact
        fields = ['contact_name', 'phone_number']
        widgets = {
            'contact_name': forms.TextInput(attrs={'class': 'form-control-premium', 'placeholder': 'Full Name'}),
            'phone_number': forms.TextInput(attrs={'class': 'form-control-premium', 'placeholder': 'Phone Number'}),
        }


class CommunityReportForm(forms.ModelForm):
    """Form to submit a community safety report."""
    report_type = forms.ChoiceField(
        choices=CommunityReport.REPORT_TYPES,
        widget=forms.Select(attrs={
            'class': 'form-control-premium',
            'id': 'id_report_type',
        })
    )
    severity = forms.ChoiceField(
        choices=CommunityReport.SEVERITY_CHOICES,
        widget=forms.Select(attrs={
            'class': 'form-control-premium',
            'id': 'id_severity',
        })
    )
    location = forms.CharField(
        max_length=255,
        widget=forms.TextInput(attrs={
            'class': 'form-control-premium',
            'placeholder': 'e.g. MG Road, near bus stop',
            'id': 'id_location',
        })
    )
    latitude = forms.DecimalField(
        required=False,
        widget=forms.HiddenInput(attrs={'id': 'id_latitude'})
    )
    longitude = forms.DecimalField(
        required=False,
        widget=forms.HiddenInput(attrs={'id': 'id_longitude'})
    )
    description = forms.CharField(
        required=False,
        widget=forms.Textarea(attrs={
            'class': 'form-control-premium',
            'placeholder': 'Describe what happened (optional)',
            'rows': 3,
            'id': 'id_description',
        })
    )


    class Meta:
        model = CommunityReport
        fields = ['report_type', 'severity', 'location', 'latitude', 'longitude', 'description']
